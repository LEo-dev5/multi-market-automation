import requests
import time
import re
from config import ST11_API_KEY, STOP_COMMANDS, RESUME_COMMANDS, COL_11ST
from sheets import check_done

BASE_URL = "http://api.11st.co.kr/rest"


def get_headers(method="GET"):
    headers = {"openapikey": ST11_API_KEY}
    if method == "PUT":
        headers["Content-Type"] = "application/xml;charset=UTF-8"
    return headers


def get_prd_no(pcode):
    url = f"{BASE_URL}/prodmarketservice/sellerprodcode/{requests.utils.quote(pcode)}"
    res = requests.get(url, headers=get_headers())

    if res.status_code == 200:
        try:
            # EUC-KR 응답에서 prdNo만 추출
            text = res.content.decode("euc-kr", errors="ignore")
            match = re.search(r"<prdNo>(\d+)</prdNo>", text)
            if match:
                return {"success": True, "data": match.group(1)}
            return {"success": False, "message": "상품없음"}
        except Exception as e:
            return {"success": False, "message": f"파싱오류: {e}"}

    return {"success": False, "message": f"1단계 에러({res.status_code})"}


def update_status(prd_no, action):
    url = f"{BASE_URL}/prodstatservice/stat/{action}/{prd_no}"
    res = requests.put(url, headers={"openapikey": ST11_API_KEY})

    if res.status_code == 200:
        text = res.text
        match_code = re.search(r"<resultCode>(\d+)</resultCode>", text)
        if match_code and match_code.group(1) == "200":
            return {"success": True}
        match_msg = re.search(r"<message>(.*?)</message>", text)
        msg = match_msg.group(1) if match_msg else "알수없는오류"
        return {"success": False, "message": msg}

    return {"success": False, "message": f"2단계 에러({res.status_code})"}


def run(sheet, rows):
    for row in rows:
        if row["st11_done"] == "TRUE":
            continue

        pcode = row["pcode"]
        request = row["request"]
        row_num = row["row_num"]

        if request in STOP_COMMANDS:
            action = "stopdisplay"
        elif request in RESUME_COMMANDS:
            action = "restartdisplay"
        else:
            continue

        try:
            res1 = get_prd_no(pcode)
            if not res1["success"]:
                if "상품없음" in res1["message"]:
                    check_done(sheet, row_num, COL_11ST)
                print(f"[11번가] {pcode} 1단계 실패: {res1['message']}")
                continue

            res2 = update_status(res1["data"], action)
            if res2["success"]:
                check_done(sheet, row_num, COL_11ST)
                print(f"[11번가] {pcode} {action} 완료")
            else:
                print(f"[11번가] {pcode} 2단계 실패: {res2['message']}")

        except Exception as e:
            print(f"[11번가] {pcode} 에러: {e}")

        time.sleep(1)
