import requests
import time
import bcrypt
import pybase64
from config import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_CLIENT_ID_2, NAVER_CLIENT_SECRET_2, STOP_COMMANDS, RESUME_COMMANDS, COL_NAVER
from sheets import check_done

BASE_URL = "https://api.commerce.naver.com/external"


def get_token(client_id, client_secret):
    timestamp = str(int((time.time() - 3) * 1000))
    password = f"{client_id}_{timestamp}"
    hashed = bcrypt.hashpw(password.encode("utf-8"), client_secret.encode("utf-8"))
    client_secret_sign = pybase64.standard_b64encode(hashed).decode("utf-8")

    res = requests.post(
        f"{BASE_URL}/v1/oauth2/token",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "client_id": client_id,
            "timestamp": timestamp,
            "grant_type": "client_credentials",
            "client_secret_sign": client_secret_sign,
            "type": "SELF"
        }
    )

    if res.status_code == 200:
        return {"success": True, "data": res.json()["access_token"]}
    return {"success": False, "message": f"토큰발급 실패({res.status_code}): {res.text}"}


def get_origin_product_no(pcode, token):
    res = requests.post(
        f"{BASE_URL}/v1/products/search",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "searchKeywordType": "SELLER_CODE",
            "sellerManagementCode": pcode,
            "page": 1,
            "size": 10
        }
    )

    if res.status_code == 200:
        contents = res.json().get("contents", [])
        if contents:
            return {"success": True, "data": contents[0]["originProductNo"]}
        return {"success": False, "message": "상품없음"}
    return {"success": False, "message": f"1단계 에러({res.status_code}): {res.text}"}


def update_status(origin_product_no, status_type, token):
    res = requests.put(
        f"{BASE_URL}/v1/products/origin-products/{origin_product_no}/change-status",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"statusType": status_type}
    )

    if res.status_code == 200:
        return {"success": True}
    return {"success": False, "message": f"2단계 에러({res.status_code}): {res.text}"}


def run(sheet, rows):
    token_res1 = get_token(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)
    token_res2 = get_token(NAVER_CLIENT_ID_2, NAVER_CLIENT_SECRET_2)

    if not token_res1["success"]:
        print(f"[스마트스토어] 베이킹몬 토큰 발급 실패: {token_res1['message']}")
    if not token_res2["success"]:
        print(f"[스마트스토어] 프레시몬 토큰 발급 실패: {token_res2['message']}")

    tokens = []
    if token_res1["success"]:
        tokens.append(token_res1["data"])
    if token_res2["success"]:
        tokens.append(token_res2["data"])

    if not tokens:
        print("[스마트스토어] 모든 토큰 발급 실패")
        return

    for row in rows:
        if row["naver_done"] == "TRUE":
            continue

        pcode = row["pcode"]
        request = row["request"]
        row_num = row["row_num"]

        if request in STOP_COMMANDS:
            status_type = "SUSPENSION"
        elif request in RESUME_COMMANDS:
            status_type = "SALE"
        else:
            continue

        try:
            found_list = []
            for token in tokens:
                res1 = get_origin_product_no(pcode, token)
                if res1["success"]:
                    found_list.append({"token": token, "no": res1["data"]})

            if not found_list:
                print(f"[스마트스토어] {pcode} 상품없음 (두 계정 모두)")
                check_done(sheet, row_num, COL_NAVER)
                continue

            for found in found_list:
                res2 = update_status(found["no"], status_type, found["token"])
                if res2["success"]:
                    print(f"[스마트스토어] {pcode} {status_type} 완료")
                else:
                    print(f"[스마트스토어] {pcode} 실패: {res2['message']}")

            check_done(sheet, row_num, COL_NAVER)

        except Exception as e:
            print(f"[스마트스토어] {pcode} 에러: {e}")

        time.sleep(1)
