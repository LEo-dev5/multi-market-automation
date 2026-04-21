import requests
import time
from config import LOTTE_VENDOR_ID, LOTTE_API_KEY, STOP_COMMANDS, RESUME_COMMANDS, COL_LOTTE
from sheets import check_done

BASE_URL = "https://openapi.lotteon.com"


def get_headers():
    return {
        "Authorization": f"Bearer {LOTTE_API_KEY}",
        "Accept": "application/json",
        "Accept-Language": "ko",
        "X-Timezone": "GMT+09:00",
        "Content-Type": "application/json"
    }


def get_spd_no(pcode):
    url = BASE_URL + "/v1/openapi/product/v1/product/list"
    body = {
        "trGrpCd": "SR",
        "trNo": LOTTE_VENDOR_ID,
        "epdNo": [pcode],
        "regStrtDttm": "20000101000000",
        "regEndDttm": "99991231235959",
        "pageNo": 1,
        "rowsPerPage": 10
    }
    res = requests.post(url, headers=get_headers(), json=body)
    if res.status_code == 200:
        items = res.json().get("data", [])
        if items:
            return {"success": True, "data": items[0]["spdNo"]}
        return {"success": False, "message": "상품없음"}
    return {"success": False, "message": f"1단계 에러({res.status_code})"}


def update_status(spd_no, sl_stat_cd):
    url = BASE_URL + "/v1/openapi/product/v1/product/status/change"
    body = {
        "spdLst": [
            {
                "trGrpCd": "SR",
                "trNo": LOTTE_VENDOR_ID,
                "lrtrNo": "",
                "spdNo": spd_no,
                "slStatCd": sl_stat_cd
            }
        ]
    }
    res = requests.post(url, headers=get_headers(), json=body)
    if res.status_code == 200:
        data = res.json()
        if data.get("returnCode") == "0000":
            return {"success": True}
        return {"success": False, "message": data.get("message")}
    return {"success": False, "message": f"2단계 에러({res.status_code})"}


def run(sheet, rows):
    for row in rows:
        if row["lotte_done"] == "TRUE":
            continue

        pcode = row["pcode"]
        request = row["request"]
        row_num = row["row_num"]

        if request in STOP_COMMANDS:
            sl_stat_cd = "SOUT"
        elif request in RESUME_COMMANDS:
            sl_stat_cd = "SALE"
        else:
            continue

        try:
            res1 = get_spd_no(pcode)
            if not res1["success"]:
                if "상품없음" in res1["message"]:
                    check_done(sheet, row_num, COL_LOTTE)
                print(f"[롯데온] {pcode} 1단계 실패: {res1['message']}")
                continue

            res2 = update_status(res1["data"], sl_stat_cd)
            if res2["success"]:
                check_done(sheet, row_num, COL_LOTTE)
                print(f"[롯데온] {pcode} {sl_stat_cd} 완료")
            else:
                print(f"[롯데온] {pcode} 2단계 실패: {res2['message']}")

        except Exception as e:
            print(f"[롯데온] {pcode} 에러: {e}")

        time.sleep(0.4)
