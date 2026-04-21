import jwt
import time
import json
import os
import requests
from config import (
    ESM_MASTER_ID, ESM_SECRET_KEY,
    ESM_AUCTION_ID, ESM_GMARKET_ID,
    STOP_COMMANDS, RESUME_COMMANDS,
    COL_ESM
)
from sheets import check_done

BASE_URL = "https://sa2.esmplus.com/item/v1"

_ESM_ITEMS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "esm_items.json")


def _load_esm_map():
    with open(_ESM_ITEMS_PATH, "r", encoding="utf-8") as f:
        items = json.load(f)
    # pcode → {"지마켓": item_no, "옥션": item_no}
    result = {}
    for item in items:
        pcode = item["pcode"]
        if pcode not in result:
            result[pcode] = {}
        result[pcode][item["site"]] = item["item_no"]
    return result


ESM_MAP = _load_esm_map()


def make_token(site="both"):
    if site == "both":
        ssi = f"A:{ESM_AUCTION_ID}, G:{ESM_GMARKET_ID}"
    elif site == "gmarket":
        ssi = f"G:{ESM_GMARKET_ID}"
    elif site == "auction":
        ssi = f"A:{ESM_AUCTION_ID}"

    header = {"kid": ESM_MASTER_ID}
    payload = {
        "sub": "sell",
        "aud": "sa.esmplus.com",
        "iss": "www.cafe24.com",
        "ssi": ssi,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600
    }
    return jwt.encode(payload, ESM_SECRET_KEY, algorithm="HS256", headers=header)


def get_goods_no(site_goods_no, token):
    url = f"{BASE_URL}/site-goods/{site_goods_no}/goods-no"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            goods_no = res.json().get("goodsNo")
            if goods_no:
                return {"success": True, "data": goods_no}
            return {"success": False, "error": f"goodsNo 없음: {res.json()}"}
        return {"success": False, "error": f"HTTP {res.status_code}: {res.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_sell_status(goods_no, token):
    url = f"{BASE_URL}/goods/{goods_no}/sell-status"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            return {"success": True, "data": res.json()}
        return {"success": False, "error": f"HTTP {res.status_code}: {res.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def update_sell_status_single(goods_no, is_sell, current_info, site, token):
    url = f"{BASE_URL}/goods/{goods_no}/sell-status"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    if site == "gmarket":
        price = current_info.get("itemBasicInfo", {}).get("Price", {}).get("gmkt", 0)
        stock = current_info.get("itemBasicInfo", {}).get("Stock", {}).get("gmkt", 0)
        body = {
            "isSell": {"gmkt": is_sell, "iac": False},
            "itemBasicInfo": {
                "price":         {"gmkt": price, "iac": 0},
                "stock":         {"gmkt": stock, "iac": 0},
                "sellingPeriod": {"gmkt": 0,     "iac": 0}
            }
        }
    else:
        price = current_info.get("itemBasicInfo", {}).get("Price", {}).get("iac", 0)
        stock = current_info.get("itemBasicInfo", {}).get("Stock", {}).get("iac", 0)
        body = {
            "isSell": {"gmkt": False, "iac": is_sell},
            "itemBasicInfo": {
                "price":         {"gmkt": 0, "iac": price},
                "stock":         {"gmkt": 0, "iac": stock},
                "sellingPeriod": {"gmkt": 0, "iac": 0}
            }
        }

    try:
        res = requests.put(url, headers=headers, json=body, timeout=10)
        if res.status_code in (200, 201, 204):
            return {"success": True}
        return {"success": False, "error": f"HTTP {res.status_code}: {res.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def process_site(site_name, item_no, is_sell, site_key, token_site):
    token = make_token(site=token_site)

    res1 = get_goods_no(item_no, token)
    if not res1["success"]:
        print(f"[ESM][{site_name}] goodsNo 조회 실패 - {res1['error']}")
        return False

    goods_no = res1["data"]
    print(f"[ESM][{site_name}] goodsNo: {goods_no}")

    res2 = get_sell_status(goods_no, token)
    if not res2["success"]:
        print(f"[ESM][{site_name}] 현재 상태 조회 실패 - {res2['error']}")
        return False

    current_info = res2["data"]
    price_key = "gmkt" if site_key == "gmarket" else "iac"
    price = current_info.get("itemBasicInfo", {}).get("Price", {}).get(price_key)
    print(f"[ESM][{site_name}] 현재 가격: {price}")

    res3 = update_sell_status_single(goods_no, is_sell, current_info, site_key, token)
    if not res3["success"]:
        print(f"[ESM][{site_name}] 판매상태 수정 실패 - {res3['error']}")
        return False

    print(f"[ESM][{site_name}] 완료 - goodsNo:{goods_no} 판매가능:{is_sell}")
    return True


def process_row(sheet, row):
    pcode = row["pcode"]
    request = row["request"]
    row_num = row["row_num"]

    if row["esm_done"] == "TRUE":
        return

    if request in STOP_COMMANDS:
        is_sell = False
    elif request in RESUME_COMMANDS:
        is_sell = True
    else:
        return

    print(f"[ESM] 처리 중 - 행:{row_num} P코드:{pcode} 요청:{request}")

    site_map = ESM_MAP.get(pcode)
    if not site_map:
        print(f"[ESM] {pcode} → 지마켓/옥션 미등록 상품, 완료 처리")
        check_done(sheet, row_num, COL_ESM)
        return

    gmarket_ok = False
    auction_ok = False

    gmarket_item_no = site_map.get("지마켓")
    if gmarket_item_no:
        gmarket_ok = process_site("지마켓", gmarket_item_no, is_sell, "gmarket", "gmarket")
    else:
        print(f"[ESM] {pcode} 지마켓 item_no 없음")

    time.sleep(0.5)

    auction_item_no = site_map.get("옥션")
    if auction_item_no:
        auction_ok = process_site("옥션", auction_item_no, is_sell, "auction", "auction")
    else:
        print(f"[ESM] {pcode} 옥션 item_no 없음")

    # 하나라도 실패 시 시트에 완료 표시하지 않음
    if gmarket_ok and auction_ok:
        check_done(sheet, row_num, COL_ESM)
    else:
        print(f"[ESM] {pcode} 일부 실패 - G마켓:{gmarket_ok} 옥션:{auction_ok}")


def run(sheet, rows):
    print("[ESM] 시작")
    for row in rows:
        if row["esm_done"] == "TRUE":
            continue
        process_row(sheet, row)
        time.sleep(0.5)
    print("[ESM] 종료")
