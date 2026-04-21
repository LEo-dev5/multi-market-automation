// ============ [설정] ============
const SHEET_NAME = "name";  // 시트 이름
const START_ROW = number;   // 시작 행
const COL_PCODE = 2;        // B열
const COL_NAME = 4;         // D열
const COL_CMD = 5;          // E열
const COL_STOCK_INFO = 6;   // F열
const COL_CHILD_START = 8;  // H열
const COL_CHILD_END = 17;   // Q열
const COL_CHECK = 18;       // R열

const SCOPES = "mall.read_product,mall.write_product";
const API_CALL_DELAY = 500;

// ============ [메뉴] ============
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚡️카페24 자동화설정')
    .addItem('1. API 키 설정 (ID/Secret)', 'setApiKeys')
    .addItem('2. 쇼핑몰 ID 설정', 'setMallId')
    .addItem('3. 카페24 로그인 (인증)', 'showAuthSidebar')
    .addSeparator()
    .addItem('4. 자동화 시작 (1분 단위)', 'startAutomation')
    .addItem('5. 자동화 중지', 'stopAutomation')
    .addItem('🤖 자동화 상태 확인', 'checkAutomationStatus')
    .addItem('🔑 토큰 상태 확인', 'checkTokenStatus')
    .addToUi();
}

// ============ [상태 확인] ============
function checkAutomationStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const props = PropertiesService.getScriptProperties();

  let message = "=== 🤖 자동화 상태 ===\n\n";

  let mainRoutineCount = 0;
  let dailyCheckCount = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'mainRoutine') mainRoutineCount++;
    if (trigger.getHandlerFunction() === 'dailyHealthCheck') dailyCheckCount++;
  });

  if (mainRoutineCount === 0) {
    message += "❌ 메인 자동화: 중지됨\n";
    message += "   조치: 메뉴 → 4. 자동화 시작\n\n";
  } else if (mainRoutineCount === 1) {
    message += "✅ 메인 자동화: 정상 작동 중\n";
    message += "   (1분마다 실행)\n\n";
  } else {
    message += "⚠️ 메인 자동화: 중복 (" + mainRoutineCount + "개)\n";
    message += "   조치: 메뉴 → 5. 중지 후 4. 시작\n\n";
  }

  if (dailyCheckCount === 0) {
    message += "⚠️ 일일 체크: 미설정\n";
    message += "   권장: 자동화 시작 시 자동 생성됨\n\n";
  } else {
    message += "✅ 일일 체크: 활성화 (매일 오전 9시)\n\n";
  }

  const tokenTime = props.getProperty("TOKEN_TIME");
  if (tokenTime) {
    const elapsed = new Date().getTime() - parseInt(tokenTime);
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);

    message += "🔑 토큰 상태:\n";
    message += "   마지막 갱신: " + hours + "시간 " + minutes + "분 전\n";

    if (hours >= 24) {
      message += "   ⚠️ 24시간 이상 갱신 안 됨\n";
      message += "   → 자동화가 멈췄을 가능성\n\n";
    } else if (hours >= 2) {
      message += "   ⚠️ 2시간 이상 (곧 만료)\n\n";
    } else {
      message += "   ✅ 정상 (2시간 이내)\n\n";
    }
  } else {
    message += "❌ 토큰: 없음\n";
    message += "   조치: 메뉴 → 3. 카페24 로그인\n\n";
  }

  const lastRefresh = props.getProperty("LAST_REFRESH_TIME");
  if (lastRefresh) {
    message += "📅 마지막 갱신 일시:\n";
    message += "   " + lastRefresh + "\n\n";
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("API_로그");
  if (logSheet && logSheet.getLastRow() > 1) {
    const lastLog = logSheet.getRange(logSheet.getLastRow(), 1, 1, 3).getValues()[0];
    const logAge = new Date().getTime() - new Date(lastLog[0]).getTime();
    const logMinutes = Math.floor(logAge / 60000);

    message += "📋 최근 활동:\n";
    message += "   " + logMinutes + "분 전\n";
    message += "   레벨: " + lastLog[1] + "\n";
    message += "   메시지: " + lastLog[2] + "\n";

    if (logMinutes > 60) {
      message += "   ⚠️ 1시간 이상 활동 없음\n";
    }
  }

  SpreadsheetApp.getUi().alert(message);
}

function checkTokenStatus() {
  const props = PropertiesService.getScriptProperties();
  const tokenTime = props.getProperty("TOKEN_TIME");
  const lastRefresh = props.getProperty("LAST_REFRESH_TIME");
  const refreshToken = props.getProperty("REFRESH_TOKEN");
  const now = new Date().getTime();

  let message = "=== 🔑 토큰 상태 ===\n\n";

  if (tokenTime) {
    const elapsed = now - parseInt(tokenTime);
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);

    message += "⏰ Access Token:\n";
    message += "   마지막 갱신: " + hours + "시간 " + minutes + "분 전\n";

    if (elapsed > 7200000) {
      message += "   상태: ⚠️ 만료됨 (2시간 초과)\n";
      message += "   조치: 자동 갱신 시도됨\n\n";
    } else {
      message += "   상태: ✅ 유효함\n\n";
    }
  } else {
    message += "❌ Access Token: 없음\n\n";
  }

  if (refreshToken) {
    message += "🔄 Refresh Token: ✅ 존재함\n";
    message += "   유효기간: 약 2주\n";
    message += "   (사용할 때마다 갱신됨)\n\n";
  } else {
    message += "❌ Refresh Token: 없음\n";
    message += "   조치: 메뉴 → 3. 카페24 로그인\n\n";
  }

  if (lastRefresh) {
    message += "📅 마지막 갱신 일시:\n";
    message += "   " + lastRefresh + "\n\n";
  }

  message += "💡 권장 사항:\n";
  message += "- 자동화가 계속 실행되면\n";
  message += "  토큰이 자동으로 계속 갱신됨\n";
  message += "- 컴퓨터를 꺼도 Google 서버에서\n";
  message += "  계속 실행됨 (문제없음)\n";

  SpreadsheetApp.getUi().alert(message);
}

// ============ [설정 및 인증] ============
function setApiKeys() {
  const ui = SpreadsheetApp.getUi();
  const id = ui.prompt("Client ID를 입력하세요").getResponseText().trim();
  const secret = ui.prompt("Client Secret를 입력하세요").getResponseText().trim();
  if (id && secret) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty("CLIENT_ID", id);
    props.setProperty("CLIENT_SECRET", secret);
    ui.alert("✅ API 키가 저장되었습니다.");
  }
}

function setMallId() {
  const ui = SpreadsheetApp.getUi();
  const mallId = ui.prompt("쇼핑몰 ID를 입력하세요").getResponseText().trim();
  if (mallId) {
    PropertiesService.getScriptProperties().setProperty("MALL_ID", mallId);
    ui.alert("✅ 쇼핑몰 ID 저장 완료");
  }
}

function showAuthSidebar() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty("CLIENT_ID");
  const mallId = props.getProperty("MALL_ID");

  if (!clientId || !mallId) {
    SpreadsheetApp.getUi().alert("❌ 먼저 1, 2번 메뉴 설정을 완료해주세요.");
    return;
  }

  const redirectUri = "앱 스크립트 주소";

  const authUrl = "https://" + mallId + ".cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=" + clientId + "&state=st&redirect_uri=" + redirectUri + "&scope=" + SCOPES;

  const html = HtmlService.createHtmlOutput(
    '<div style="text-align:center; font-family:sans-serif;">' +
      '<h3>카페24 인증</h3>' +
      '<p>아래 버튼을 눌러 로그인을 완료하세요.</p>' +
      '<a href="' + authUrl + '" target="_blank" style="background:#007bff; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">로그인하기</a>' +
    '</div>'
  ).setTitle('카페24 로그인');
  SpreadsheetApp.getUi().showSidebar(html);
}

function doGet(e) {
  const code = e.parameter.code;
  if (code) {
    getInitialToken(code);
    return HtmlService.createHtmlOutput("<h2>✅ 인증 성공!</h2><p>창을 닫고 자동화를 시작하세요.</p>");
  }
  return HtmlService.createHtmlOutput("Token Error");
}

function getInitialToken(code) {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty("CLIENT_ID");
  const clientSecret = props.getProperty("CLIENT_SECRET");
  const mallId = props.getProperty("MALL_ID");

  const url = "https://" + mallId + ".cafe24api.com/api/v2/oauth/token";

  const headers = {
    'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret),
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const payload = {
    "grant_type": "authorization_code",
    "code": code,
    "redirect_uri": "앱 스크립트 주소"
  };

  const options = {
    'method': 'post',
    'headers': headers,
    'payload': payload,
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const resText = response.getContentText();
  const json = JSON.parse(resText);

  if (json.access_token) {
    props.setProperty("ACCESS_TOKEN", json.access_token);
    props.setProperty("REFRESH_TOKEN", json.refresh_token);
    props.setProperty("TOKEN_TIME", new Date().getTime());
    props.setProperty("LAST_REFRESH_TIME", new Date().toISOString());
  } else {
    throw new Error("카페24 응답 에러: " + resText);
  }
}

function getValidAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const accessToken = props.getProperty("ACCESS_TOKEN");
  const tokenTime = props.getProperty("TOKEN_TIME");
  const now = new Date().getTime();
  if (!accessToken || (now - tokenTime) > 6600000) return refreshAccessToken();
  return accessToken;
}

function refreshAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const refreshToken = props.getProperty("REFRESH_TOKEN");
  const clientId = props.getProperty("CLIENT_ID");
  const clientSecret = props.getProperty("CLIENT_SECRET");
  const mallId = props.getProperty("MALL_ID");

  if (!refreshToken) {
    logToSheet("ERROR", "Refresh Token 없음", { action: "재인증 필요" });
    throw new Error("인증 정보가 없습니다. 메뉴 → 3. 카페24 로그인 필요");
  }

  const payload = {
    'grant_type': 'refresh_token',
    'refresh_token': refreshToken
  };
  const headers = {
    'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret),
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const response = UrlFetchApp.fetch("https://" + mallId + ".cafe24api.com/api/v2/oauth/token", {
    'method': 'post',
    'headers': headers,
    'payload': payload,
    'muteHttpExceptions': true
  });

  const json = JSON.parse(response.getContentText());

  if (json.access_token) {
    props.setProperty("ACCESS_TOKEN", json.access_token);
    if (json.refresh_token) {
      props.setProperty("REFRESH_TOKEN", json.refresh_token);
    }
    props.setProperty("TOKEN_TIME", new Date().getTime());
    props.setProperty("LAST_REFRESH_TIME", new Date().toISOString());
    console.log("✅ 토큰 자동 갱신 완료");
    logToSheet("INFO", "토큰 갱신 성공", { time: new Date().toISOString() });
    return json.access_token;
  } else {
    const errorMsg = json.error_description || response.getContentText();
    logToSheet("ERROR", "토큰 갱신 실패", { error: errorMsg, action: "재인증 필요" });
    throw new Error("토큰 갱신 실패. 메뉴 → 3. 카페24 로그인 필요");
  }
}

// ============ [트리거] ============
function startAutomation() {
  try {
    getValidAccessToken();
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      "⚠️ 인증 만료\n\n" +
      "먼저 메뉴 → 3. 카페24 로그인을 실행해주세요."
    );
    return;
  }

  stopAutomation();

  ScriptApp.newTrigger("mainRoutine")
    .timeBased()
    .everyMinutes(1)
    .create();

  ScriptApp.newTrigger("dailyHealthCheck")
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  logToSheet("INFO", "자동화 시작", {
    mainRoutine: "1분마다",
    healthCheck: "매일 오전 9시"
  });

  SpreadsheetApp.getUi().alert(
    "✅ 자동화 시작 완료!\n\n" +
    "- 메인 자동화: 1분마다 실행\n" +
    "- 일일 상태 체크: 매일 오전 9시\n" +
    "- 트리거 자동 재시작: 활성화\n\n" +
    "컴퓨터를 꺼도 계속 작동합니다!"
  );
}

function stopAutomation() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  logToSheet("INFO", "자동화 중지", {});
}

// ============ [일일 상태 체크] ============
function dailyHealthCheck() {
  console.log("=== 일일 상태 체크 시작 ===");

  const triggers = ScriptApp.getProjectTriggers();
  const props = PropertiesService.getScriptProperties();

  let hasMainRoutine = false;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'mainRoutine') hasMainRoutine = true;
  });

  if (!hasMainRoutine) {
    console.warn("⚠️ 메인 트리거 꺼짐 감지!");
    logToSheet("ERROR", "일일 체크: 메인 트리거 꺼짐", { action: "자동 재시작 시도" });
    try {
      ScriptApp.newTrigger("mainRoutine")
        .timeBased()
        .everyMinutes(1)
        .create();
      logToSheet("INFO", "메인 트리거 자동 재시작 성공", {});
      console.log("✅ 메인 트리거 자동 재시작 완료");
    } catch (e) {
      logToSheet("ERROR", "메인 트리거 재시작 실패", { error: e.message });
    }
  } else {
    console.log("✅ 메인 트리거 정상");
  }

  const tokenTime = props.getProperty("TOKEN_TIME");
  if (tokenTime) {
    const elapsed = new Date().getTime() - parseInt(tokenTime);
    const hours = Math.floor(elapsed / 3600000);
    if (hours > 24) {
      logToSheet("WARN", "일일 체크: 토큰 24시간 이상 갱신 안 됨", {
        hours: hours,
        recommendation: "자동화가 멈췄을 가능성"
      });
      console.warn("⚠️ 토큰 24시간 이상 갱신 안 됨");
    } else {
      console.log("✅ 토큰 상태 정상");
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("API_로그");
  if (logSheet && logSheet.getLastRow() > 1) {
    const lastLog = logSheet.getRange(logSheet.getLastRow(), 1).getValue();
    const logAge = new Date().getTime() - new Date(lastLog).getTime();
    if (logAge > 3600000) {
      logToSheet("WARN", "일일 체크: 1시간 동안 활동 없음", { lastActivity: lastLog });
      console.warn("⚠️ 1시간 동안 활동 없음");
    } else {
      console.log("✅ 최근 활동 정상");
    }
  }

  logToSheet("INFO", "일일 상태 체크 완료", { date: new Date().toISOString() });
  console.log("=== 일일 상태 체크 종료 ===");
}

// ============ [로깅] ============
function logToSheet(level, message, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName("API_로그");

    if (!logSheet) {
      logSheet = ss.insertSheet("API_로그");
      logSheet.getRange(1, 1, 1, 5).setValues([["시간", "레벨", "메시지", "상세정보", "행번호"]]);
      logSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }

    const detailsStr = details ? JSON.stringify(details) : "";

    logSheet.appendRow([
      new Date(),
      level,
      message,
      detailsStr,
      details && details.row ? details.row : ""
    ]);

    if (logSheet.getLastRow() > 1001) {
      logSheet.deleteRows(2, logSheet.getLastRow() - 1001);
    }
  } catch (e) {
    console.error("로그 기록 실패: " + e.message);
  }
}

// ============ [트리거 자동 재시작] ============
function ensureTriggerActive() {
  const triggers = ScriptApp.getProjectTriggers();
  let hasMainRoutine = false;

  for (let trigger of triggers) {
    if (trigger.getHandlerFunction() === 'mainRoutine') {
      hasMainRoutine = true;
      break;
    }
  }

  if (!hasMainRoutine) {
    console.warn("⚠️ 트리거 꺼짐 감지 - 자동 재시작 시도");
    try {
      ScriptApp.newTrigger("mainRoutine")
        .timeBased()
        .everyMinutes(1)
        .create();
      logToSheet("WARN", "트리거 자동 재시작", {
        reason: "트리거 비활성화 감지",
        action: "자동으로 재생성함",
        time: new Date().toISOString()
      });
      console.log("✅ 트리거 자동 재시작 완료");
    } catch (e) {
      console.error("❌ 트리거 재시작 실패: " + e.message);
      logToSheet("ERROR", "트리거 재시작 실패", { error: e.message });
    }
  }
}

// ============ [메인 루틴] ============
function mainRoutine() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.log("⚠️ 이전 작업 실행 중");
    return;
  }

  try {
    ensureTriggerActive();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      console.error("❌ '" + SHEET_NAME + "' 시트 없음");
      return;
    }

    const lastRow = sheet.getLastRow();
    console.log("--- 🚀 자동화 시작 ---");

    if (lastRow < START_ROW) {
      console.log("ℹ️ 처리 데이터 없음");
      return;
    }

    const readStartRow = START_ROW;
    const numRows = lastRow - readStartRow + 1;
    console.log("🔍 스캔: " + readStartRow + "~" + lastRow + "행");

    const range = sheet.getRange(readStartRow, 1, numRows, 18);
    const values = range.getValues();

    let token = getValidAccessToken();
    const mallId = PropertiesService.getScriptProperties().getProperty("MALL_ID");

    let processedCount = 0;
    let skipCount = 0;

    for (let i = 0; i < values.length; i++) {
      const rowData = values[i];
      const currentRowNum = readStartRow + i;

      const isChecked = rowData[COL_CHECK - 1] === true || rowData[COL_CHECK - 1] === "TRUE";
      if (isChecked) {
        skipCount++;
        continue;
      }

      const pCode = rowData[COL_PCODE - 1];
      const command = rowData[COL_CMD - 1];

      if (!command || !pCode) continue;

      console.log("⚙️ " + currentRowNum + "행: [" + pCode + " / " + command + "]");
      processedCount++;

      const pName = rowData[COL_NAME - 1];
      const stockInfo = rowData[COL_STOCK_INFO - 1];

      let targetCodes = [pCode];
      for (let j = COL_CHILD_START - 1; j < COL_CHILD_END; j++) {
        if (rowData[j]) targetCodes.push(rowData[j]);
      }

      try {
        const hasMissing = processRow(token, mallId, targetCodes, command, pName, stockInfo, currentRowNum);
        const checkCell = sheet.getRange(currentRowNum, COL_CHECK);
        checkCell.setValue(true);

        if (hasMissing) {
          checkCell.setBackground("#ff0000");
          console.warn("⚠️ " + currentRowNum + "행: 일부 실패");
        } else {
          checkCell.setBackground(null);
          console.log("✅ " + currentRowNum + "행: 성공");
        }
      } catch (e) {
        console.error("❌ " + currentRowNum + "행: " + e.message);
        logToSheet("ERROR", "처리 실패", { row: currentRowNum, code: pCode, error: e.message });
      }
    }

    console.log("--- 🏁 종료 (처리: " + processedCount + ") ---");

  } catch (e) {
    console.error("mainRoutine 에러: " + e.message);
    logToSheet("ERROR", "mainRoutine 실패", { error: e.message, stack: e.stack });
  } finally {
    lock.releaseLock();
  }
}

function processRow(token, mallId, codes, command, pName, stockInfo, rowNum) {
  let missing = false;

  codes.forEach(code => {
    code = String(code).trim().toUpperCase();
    if (code === "") return;

    if (code.length > 12) {
      console.error("   ✗ 코드 길이 초과: " + code.length);
      missing = true;
      return;
    }

    try {
      if (code.length <= 8) {
        console.log("   → 상품: " + code);
        const pNo = getProductNoByCode(token, mallId, code);

        if (pNo) {
          const curName = getProductNameByNo(token, mallId, pNo);
          const payloads = getPayloadByCommand(command, pName, stockInfo, curName);
          if (payloads) {
            updateProduct(token, mallId, pNo, payloads.product);
            console.log("   ✓ 상품 업데이트 성공: " + code);

            let invPayload = null;

            if (command.includes("품절해제")) {
              invPayload = { "selling": "T", "use_inventory": "F", "display_soldout": "F" };
            } else if (command.includes("수량제한해제") || command.includes("수량제한 해제")) {
              invPayload = { "use_inventory": "F", "display_soldout": "F" };
            } else if (command.includes("수량제한")) {
              const stockInfoStr = String(stockInfo);
              let qty = 0;
              const inventoryMatch = stockInfoStr.match(/수량제한[^\d]*(\d+)/);
              if (inventoryMatch) {
                qty = parseInt(inventoryMatch[1]);
              } else {
                const numberMatch = stockInfoStr.match(/(\d+)/);
                if (numberMatch) qty = parseInt(numberMatch[1]);
              }
              if (qty > 0) {
                console.log("   📦 수량제한(" + qty + "개) → variant inventories 업데이트");
                invPayload = { "selling": "T", "use_inventory": "T", "quantity": qty, "display_soldout": "T" };
              }
            }

            if (invPayload) {
              const variants = getVariantList(token, mallId, pNo);
              if (variants && variants.length > 0) {
                for (let vi = 0; vi < variants.length; vi++) {
                  const vCode = variants[vi].variant_code;
                  const invSuccess = updateVariantInventories(token, mallId, pNo, vCode, invPayload);
                  if (invSuccess) {
                    console.log("   📦 ✓ inventories 성공: " + vCode);
                  } else {
                    console.warn("   📦 ✗ inventories 실패: " + vCode);
                    missing = true;
                  }
                  Utilities.sleep(API_CALL_DELAY);
                }
              } else {
                console.warn("   📦 variant 목록 조회 실패 (상품번호: " + pNo + ")");
                logToSheet("WARN", "variant 목록 조회 실패", { row: rowNum, product_no: pNo, code: code });
              }
            }
          }
        } else {
          console.warn("   ⚠️ 조회 실패 (삭제된 상품): " + code);
        }
      } else if (code.length === 12) {
        console.log("   → 옵션: " + code);
        const info = getProductNoByVariantCode(token, mallId, code);

        if (info && info.product_no) {
          const variantDetails = getVariantDetails(token, mallId, info.product_no, code);

          if (variantDetails) {
            const payloads = getPayloadByCommand(command, pName, stockInfo, null);
            if (payloads) {
              try {
                updateVariantImproved(token, mallId, info.product_no, code, payloads.variant, variantDetails);
                console.log("   ✓ 성공: " + code);
              } catch (e) {
                // 카페24 API 정책상 조합 일체선택형 옵션은 개별 제어 불가
                if (e.message && e.message.includes("Single product")) {
                  console.warn("   🔴 조합 일체선택형 옵션 - 수동 처리 필요");
                  logToSheet("WARN", "수동 처리 필요", {
                    row: rowNum,
                    code: code,
                    type: "조합 일체선택형 옵션",
                    action: "카페24 관리자에서 수동 처리 필요"
                  });
                  missing = true;
                } else {
                  throw e;
                }
              }
            }
          } else {
            console.warn("   ⚠️ 상세 조회 실패 (삭제된 옵션): " + code);
          }
        } else {
          console.warn("   ⚠️ 조회 실패 (삭제된 옵션): " + code);
        }
      } else {
        console.error("   ✗ 비정상 길이: " + code.length);
        missing = true;
      }

      Utilities.sleep(API_CALL_DELAY);

    } catch (e) {
      console.error("   ✗ 에러: " + e.message);
      missing = true;
    }
  });

  return missing;
}

function getPayloadByCommand(command, pName, stockInfo, currentName) {
  // D열 pName은 관리용 명칭으로 상품명 변경에 사용하지 않음
  let pData = {}, vData = {};

  if (command.includes("수량제한해제") || command.includes("수량제한 해제")) {
    let cleanedName = currentName;
    if (currentName) {
      cleanedName = currentName.replace(/\[수량제한\/[^\]]*\]/g, "").trim();
    }

    pData = {
      "use_inventory": "F",
      "display_soldout": "F",
      "minimum_quantity": 1,
      "maximum_quantity": 0  // 0 = 제한 없음
    };

    if (cleanedName && cleanedName !== currentName) {
      pData.product_name = cleanedName;
    }

    vData = {
      "use_inventory": "F",
      "display_soldout": "F",
      "minimum_quantity": 1,
      "maximum_quantity": 0
    };
  } else if (command.includes("수량제한")) {
    const stockInfoStr = String(stockInfo);
    let inventoryQty = 0;

    const inventoryMatch = stockInfoStr.match(/수량제한[^\d]*(\d+)/);
    if (inventoryMatch) {
      inventoryQty = parseInt(inventoryMatch[1]);
    } else {
      const numberMatch = stockInfoStr.match(/(\d+)/);
      if (numberMatch) inventoryQty = parseInt(numberMatch[1]);
    }

    const maxPurchaseMatch = stockInfoStr.match(/최대\s*(?:구매\s*)?(\d+)개?/);
    const maxPurchaseQty = maxPurchaseMatch ? parseInt(maxPurchaseMatch[1]) : 0;

    if (inventoryQty > 0) {
      console.log("   📦 재고: " + inventoryQty);
      if (maxPurchaseQty > 0) console.log("   🛒 최대구매: " + maxPurchaseQty + "개");

      let cleanedName = currentName;
      if (currentName) {
        cleanedName = cleanedName.replace(/\[일시품절\/[^\]]*\]/g, "").trim();
        cleanedName = cleanedName.replace(/\[수량제한\/[^\]]*\]/g, "").trim();
      }

      pData = { "selling": "T", "use_inventory": "T", "quantity": inventoryQty, "display_soldout": "T" };

      if (maxPurchaseQty > 0) {
        pData.minimum_quantity = 1;
        pData.maximum_quantity = maxPurchaseQty;
      }

      if (cleanedName) {
        pData.product_name = maxPurchaseQty > 0
          ? "[수량제한/최대구매" + maxPurchaseQty + "개]" + cleanedName
          : cleanedName;
      }

      vData = { "selling": "T", "use_inventory": "T", "quantity": inventoryQty, "display_soldout": "T" };

      if (maxPurchaseQty > 0) {
        vData.minimum_quantity = 1;
        vData.maximum_quantity = maxPurchaseQty;
      }
    } else {
      console.warn("   ⚠️ 재고 없음");
      return null;
    }
  } else if (command.includes("품절해제")) {
    if (currentName) {
      const cleanedName = currentName.replace(/\[일시품절\/[^\]]*\]/g, "").trim();
      pData = { "selling": "T", "use_inventory": "F", "display_soldout": "F", "product_name": cleanedName };
    } else {
      pData = { "selling": "T", "use_inventory": "F", "display_soldout": "F" };
    }
    vData = { "selling": "T", "use_inventory": "F", "display_soldout": "F" };
  } else if (command.includes("품절")) {
    if (currentName && stockInfo && String(stockInfo).includes("입고")) {
      pData = { "selling": "F", "product_name": "[일시품절/" + stockInfo + "]" + currentName };
    } else {
      pData = { "selling": "F" };
    }
    vData = { "selling": "F" };
  } else if (command.includes("중단해제")) {
    pData = { "display": "T" };
    vData = { "display": "T" };
  } else if (command.includes("중단")) {
    pData = { "display": "F" };
    vData = { "display": "F" };
  } else {
    return null;
  }

  return { product: pData, variant: vData };
}

// ============ [API 호출] ============
function getProductNoByCode(token, mallId, pCode) {
  try {
    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products?product_code=" + pCode,
      { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const json = JSON.parse(res.getContentText());
    return (json.products && json.products.length > 0) ? json.products[0].product_no : null;
  } catch (e) {
    return null;
  }
}

function getProductNameByNo(token, mallId, pNo) {
  try {
    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo,
      { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const json = JSON.parse(res.getContentText());
    return json.product ? json.product.product_name : null;
  } catch (e) {
    return null;
  }
}

function getProductNoByVariantCode(token, mallId, vCode) {
  try {
    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products?variant_code=" + vCode,
      { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const json = JSON.parse(res.getContentText());
    return (json.products && json.products.length > 0) ? { product_no: json.products[0].product_no } : null;
  } catch (e) {
    return null;
  }
}

function getVariantDetails(token, mallId, pNo, vCode) {
  try {
    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo + "/variants/" + vCode,
      { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const json = JSON.parse(res.getContentText());
    return json.variant || null;
  } catch (e) {
    return null;
  }
}

function getProductDetails(token, mallId, pNo) {
  try {
    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo,
      { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    const json = JSON.parse(res.getContentText());
    return json.product || null;
  } catch (e) {
    console.error("getProductDetails 에러: " + e.message);
    return null;
  }
}

function getVariantList(token, mallId, pNo) {
  try {
    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo + "/variants",
      { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) {
      console.error("getVariantList 실패: HTTP " + res.getResponseCode());
      return null;
    }
    const json = JSON.parse(res.getContentText());
    return json.variants || null;
  } catch (e) {
    console.error("getVariantList 에러: " + e.message);
    return null;
  }
}

function updateProduct(token, mallId, pNo, payload) {
  try {
    console.log("   📤 요청 payload: " + JSON.stringify(payload));

    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo,
      {
        'method': 'put',
        'headers': { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        'payload': JSON.stringify({ "shop_no": 1, "request": payload }),
        'muteHttpExceptions': true
      }
    );

    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();

    console.log("   📥 응답 코드: " + statusCode);
    console.log("   📥 응답 내용: " + responseText);

    if (statusCode !== 200) {
      throw new Error("상품 업데이트 실패: " + responseText);
    }

    logToSheet("INFO", "상품 업데이트 성공", {
      product_no: pNo,
      payload: payload,
      response: responseText.substring(0, 500)
    });
  } catch (e) {
    throw new Error("updateProduct 에러: " + e.message);
  }
}

function updateVariant(token, mallId, pNo, vCode, payload) {
  updateVariantImproved(token, mallId, pNo, vCode, payload, null);
}

function updateVariantImproved(token, mallId, pNo, vCode, payload, variantDetails) {
  try {
    let finalPayload = Object.assign({}, payload);
    if (variantDetails && variantDetails.options) {
      finalPayload.options = variantDetails.options;
    }

    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo + "/variants/" + vCode,
      {
        'method': 'put',
        'headers': { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        'payload': JSON.stringify({ "shop_no": 1, "request": finalPayload }),
        'muteHttpExceptions': true
      }
    );

    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();

    // 카페24 API 정책상 조합 일체선택형 옵션은 수정 불가
    if (statusCode === 422 && responseText.includes("Single product cannot be modified")) {
      console.warn("   ⚠️ 조합 일체선택형 옵션 - 자동화 불가");
      throw new Error("Single product cannot be modified");
    }

    if (statusCode !== 200) {
      throw new Error("옵션 업데이트 실패: " + responseText);
    }
  } catch (e) {
    throw new Error("updateVariantImproved 에러: " + e.message);
  }
}

function updateVariantInventories(token, mallId, pNo, vCode, payload) {
  try {
    console.log("   📦 inventories 업데이트: " + vCode + " → " + JSON.stringify(payload));

    const res = UrlFetchApp.fetch(
      "https://" + mallId + ".cafe24api.com/api/v2/admin/products/" + pNo + "/variants/" + vCode + "/inventories",
      {
        'method': 'put',
        'headers': { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        'payload': JSON.stringify({ "shop_no": 1, "request": payload }),
        'muteHttpExceptions': true
      }
    );

    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();

    console.log("   📦 inventories 응답: HTTP " + statusCode);

    if (statusCode !== 200) {
      console.error("   📦 inventories 실패: " + responseText);
      logToSheet("ERROR", "inventories 업데이트 실패", {
        product_no: pNo,
        variant_code: vCode,
        payload: payload,
        status: statusCode,
        response: responseText.substring(0, 500)
      });
      return false;
    }

    logToSheet("INFO", "inventories 업데이트 성공", {
      product_no: pNo,
      variant_code: vCode,
      payload: payload
    });

    return true;
  } catch (e) {
    console.error("updateVariantInventories 에러: " + e.message);
    logToSheet("ERROR", "updateVariantInventories 에러", {
      product_no: pNo,
      variant_code: vCode,
      error: e.message
    });
    return false;
  }
}
