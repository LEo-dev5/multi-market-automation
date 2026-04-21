import requests
import hmac
import hashlib
import time
from datetime import datetime, timezone
from config import CP_VENDOR_ID, CP_ACCESS_KEY, CP_SECRET_KEY, STOP_COMMANDS, RESUME_COMMANDS, COL_COUPANG
from sheets import check_done


# 쿠팡은 P코드 -> 셀러상품 Id -> 벤더 아이템 Id를 거쳐서 조회 가능
# 인증 방법: AccessKey와 서명(time + path + query)를 포함해서 전송

BASE_URL = "https://api-gateway.coupang.com"


def generate_headers(method, path):
    datetime_str = datetime.now(timezone.utc).strftime("%y%m%dT%H%M%SZ")
    parts = path.split("?")
    path_only = parts[0]
    query = parts[1] if len(parts) > 1 else ""

    message = datetime_str + method + path_only + query
    signature = hmac.new(
        CP_SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return {
        "Authorization": f"CEA algorithm=HmacSHA256, access-key={CP_ACCESS_KEY}, signed-date={datetime_str}, signature={signature}",
        "X-Requested-By": CP_VENDOR_ID,
        "Content-Type": "application/json;charset=UTF-8"
    }


def get_seller_product_id(pcode):
    path = f"/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/external-vendor-sku-codes/{requests.utils.quote(pcode)}"
    res = requests.get(BASE_URL + path, headers=generate_headers("GET", path))
    if res.status_code == 200:
        data = res.json()
        if data.get("data") and len(data["data"]) > 0:
            return {"success": True, "data": data["data"][0]["sellerProductId"]}
        return {"success": False, "message": "상품없음"}
    return {"success": False, "message": f"1단계 에러({res.status_code}): {res.text}"}


def get_vendor_item_id(seller_product_id, pcode):
    path = f"/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{seller_product_id}"
    res = requests.get(BASE_URL + path, headers=generate_headers("GET", path))
    if res.status_code == 200:
        data = res.json()
        items = data.get("data", {}).get("items", [])
        for item in items:
            if str(item.get("externalVendorSku", "")).strip().upper() == pcode.strip().upper():
                return {"success": True, "data": item["vendorItemId"]}
        if items:
            return {"success": True, "data": items[0]["vendorItemId"]}
        return {"success": False, "message": "옵션ID 없음"}
    return {"success": False, "message": f"2단계 에러({res.status_code})"}


def update_sales_status(vendor_item_id, action):
    path = f"/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendor_item_id}/sales/{action}"
    res = requests.put(BASE_URL + path, headers=generate_headers("PUT", path))
    if res.status_code == 200:
        return {"success": True}
    return {"success": False, "message": f"3단계 에러({res.status_code}): {res.text}"}


def run(sheet, rows):
    for row in rows:
        if row["coupang_done"] == "TRUE":
            continue

        pcode = row["pcode"]
        request = row["request"]
        row_num = row["row_num"]

        if request in STOP_COMMANDS:
            action = "stop"
        elif request in RESUME_COMMANDS:
            action = "resume"
        else:
            continue

        try:
            res1 = get_seller_product_id(pcode)
            if not res1["success"]:
                if "상품없음" in res1["message"]:
                    check_done(sheet, row_num, COL_COUPANG)
                print(f"[쿠팡] {pcode} 1단계 실패: {res1['message']}")
                continue

            res2 = get_vendor_item_id(res1["data"], pcode)
            if not res2["success"]:
                print(f"[쿠팡] {pcode} 2단계 실패: {res2['message']}")
                continue

            res3 = update_sales_status(res2["data"], action)
            if res3["success"]:
                check_done(sheet, row_num, COL_COUPANG)
                print(f"[쿠팡] {pcode} {action} 완료")
            else:
                if "쿠팡에 의해 '판매중지'" in res3["message"]:
                    print(f"[쿠팡] {pcode} 쿠팡 직접 중지 상품 - 수동 처리 필요")
                    check_done(sheet, row_num, COL_COUPANG)
                else:
                    print(f"[쿠팡] {pcode} 3단계 실패: {res3['message']}")

        except Exception as e:
            print(f"[쿠팡] {pcode} 에러: {e}")

        time.sleep(1)
