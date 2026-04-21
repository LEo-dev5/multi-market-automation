import os
from dotenv import load_dotenv

load_dotenv()

# 구글 시트
SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH")
SHEET_NAME = "sheetname" #시트 이름 입력
START_ROW = 1   #시작행 입력

# 열 인덱스 (0부터 시작)
COL_PCODE = 1        # B열
COL_REQUEST = 4      # E열
COL_LOTTE = 25       # Y열
COL_COUPANG = 26     # Z열
COL_NAVER = 27       # AA열
COL_11ST = 28        # AB열
COL_ESM = 29         # AC열

# 요청 명령어
STOP_COMMANDS = ["품절", "수량제한", "중단"]
RESUME_COMMANDS = ["품절해제", "수량제한해제", "중단해제"]

# 쿠팡
CP_VENDOR_ID = os.getenv("CP_VENDOR_ID")
CP_ACCESS_KEY = os.getenv("CP_ACCESS_KEY")
CP_SECRET_KEY = os.getenv("CP_SECRET_KEY")

# 롯데온
LOTTE_VENDOR_ID = os.getenv("LOTTE_VENDOR_ID")
LOTTE_API_KEY = os.getenv("LOTTE_API_KEY")

# 11번가
ST11_API_KEY = os.getenv("ST11_API_KEY")

# 스마트스토어 베이킹몬
NAVER_ACCOUNT_ID = os.getenv("NAVER_ACCOUNT_ID")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

# 프레시몬
NAVER_CLIENT_ID_2 = os.getenv("NAVER_CLIENT_ID_2")
NAVER_CLIENT_SECRET_2 = os.getenv("NAVER_CLIENT_SECRET_2")

# ESM (지마켓/옥션)
ESM_MASTER_ID = os.getenv("ESM_MASTER_ID")
ESM_SECRET_KEY = os.getenv("ESM_SECRET_KEY")
ESM_AUCTION_ID = os.getenv("ESM_AUCTION_ID")
ESM_GMARKET_ID = os.getenv("ESM_GMARKET_ID")
