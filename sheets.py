import gspread
from google.oauth2.service_account import Credentials
from config import SHEET_ID, CREDENTIALS_PATH, SHEET_NAME, START_ROW
import time

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]


def get_sheet():
    creds = Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPES)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SHEET_ID)
    return spreadsheet.worksheet(SHEET_NAME)


def get_pending_rows(sheet):
    all_values = sheet.get_all_values()
    pending = []

    for i, row in enumerate(all_values):
        row_num = i + 1
        if row_num < START_ROW:
            continue

        if len(row) < 5:
            continue

        pcode = row[1].strip()      # B열
        request = row[4].strip()    # E열

        if not pcode or not request:
            continue

        pending.append({
            "row_num": row_num,
            "pcode": pcode,
            "request": request,
            "lotte_done": row[24],                          # Y열
            "coupang_done": row[25],                        # Z열
            "naver_done": row[26],                          # AA열
            "st11_done": row[27],                           # AB열
            "esm_done": row[28] if len(row) > 28 else "",  # AC열
        })

    return pending


def check_done(sheet, row_num, col):
    for attempt in range(3):
        try:
            sheet.update_cell(row_num, col, True)
            time.sleep(1.5)
            return
        except Exception as e:
            if "429" in str(e):
                print(f"구글 시트 요청 제한, {(attempt + 1) * 10}초 대기...")
                time.sleep((attempt + 1) * 10)
            else:
                raise
