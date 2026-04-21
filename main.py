from sheets import get_sheet, get_pending_rows
import coupang
import lotteon
import st11
import naver
import esm


def main():
    print("=" * 40)
    print("품절 자동화 시작")
    print("=" * 40)

    sheet = get_sheet()
    rows = get_pending_rows(sheet)

    if not rows:
        print("처리할 행 없음")
        return

    print(f"처리할 행 수: {len(rows)}")

    coupang.run(sheet, rows)
    lotteon.run(sheet, rows)
    st11.run(sheet, rows)
    naver.run(sheet, rows)
    esm.run(sheet, rows)

    print("완료")


if __name__ == "__main__":
    main()
