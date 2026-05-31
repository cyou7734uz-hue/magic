let video;
let handpose;
let hands = [];

let cards = [];
let answerBox;

let question;
let correctAnswer;

let draggingCard = null;
let handLostTimer = 0; // 防止偵測閃爍的計時器

let gameState = "START"; // START, SELECT, INFO, PLAY
let coverImg;
let btnImg;
let infoBtnImg;
let infoBgImg;
let selectBgImg;
let selectedAcademy = "MATH";
let fadeAlpha = 0;
let pendingState = null;

let monsterHP = 100;
let score = 0;

let message = "用食指抓取答案卡，拖到魔法陣";

// 平滑與參數
let smoothedKeypoints = [];
let smoothingAlpha = 0.25; // EMA alpha (較平滑)
// 捏合穩定性參數
let smoothedPinchDist = null;
let pinchDistanceAlpha = 0.25; // 平滑捏合距離 (較平滑)
let pinchHoldCounter = 0; // 當前捏合持續計數
let pinchHoldThreshold = 8; // 需要持續幾個 frame 才視為穩定捏合（增加穩定性）
let pinchDecay = 1; // 每 frame 減少的計數
let pinchStable = false; // 穩定捏合狀態
// 手勢置信度閾值
let minHandConfidence = 0.6;

//========================
// preload
//========================
function preload() {
  coverImg = loadImage('封面/封面底圖.png');
  btnImg = loadImage('封面/進入.png');
  infoBtnImg = loadImage('封面/說明.png');
  infoBgImg = loadImage('封面/說明底圖.png');
  selectBgImg = loadImage('封面/學院.png');
}

//========================
// setup
//========================
function setup(){
  createCanvas(windowWidth,windowHeight);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // 若 TensorFlow.js 可用，強制使用 WebGL 後端以避免 Windows 上呼叫 requestAdapter 時出現 powerPreference 警告
  if (window.tf && tf.setBackend) {
    try {
      tf.setBackend('webgl');
      tf.ready().then(() => console.log('tf backend:', tf.getBackend()));
    } catch (e) {
      console.warn('設定 TF backend 為 webgl 失敗:', e);
    }
  }

  // ml5 handpose 初始化兼容處理
  const handposeFn = ml5.handpose || ml5.handPose;
  console.log('handpose function available:', !!handposeFn, 'video element:', !!(video && video.elt));
  if (handposeFn) {
    const videoInput = (video && video.elt) ? video.elt : video;
    handpose = handposeFn(videoInput, modelReady);
  } else {
    console.error('Handpose model is not available on ml5.');
  }

  newQuestion();
}

function startHandposeDetection() {
  if (!handpose) return;
  console.log('startHandposeDetection methods:', {
    detectStart: !!handpose.detectStart,
    on: !!handpose.on,
    predict: !!handpose.predict
  });

  if (handpose.detectStart) {
    handpose.detectStart(video, gotHands);
    return;
  }

  if (handpose.on) {
    handpose.on('predict', gotHands);
    return;
  }

  if (handpose.predict) {
    const result = handpose.predict.length === 1 ? handpose.predict(gotHands) : handpose.predict(video, gotHands);
    if (result && result.then) {
      result.then(gotHands).catch(err => console.error('Handpose predict failed:', err));
    }
    return;
  }

  console.error('Handpose detection method not found.');
}

//========================
// handpose callbacks
//========================
function gotHands(results){
  hands = results || [];

  // 若無事件回呼機制，手動預測循環
  if (handpose && !handpose.on && !handpose.detectStart && handpose.predict) {
    const result = handpose.predict.length === 1 ? handpose.predict(gotHands) : handpose.predict(video, gotHands);
    if (result && result.then) {
      result.then(gotHands).catch(err => console.error('Handpose predict failed:', err));
    }
  }
}

function modelReady() {
  console.log("Handpose model ready");
  startHandposeDetection();
  let loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
}

//========================
// 主迴圈
//========================
function draw(){
  // --- 1. 背景底圖層 ---
  if (gameState === "START" || gameState === "INFO" || gameState === "SELECT") {
    if (!coverImg) background(50);
    else image(coverImg, 0, 0, width, height);

    let floatY = sin(millis() * 0.002) * 10;
    let baseW = 450; // 加大主按鈕
    let baseH = btnImg ? btnImg.height * (baseW / btnImg.width) : 80;

    if (gameState === "START") {
      let btn1X = width/2 - baseW/2;
      let btn1Y = height * 0.75 - 95 + floatY;
      let isHover1 = mouseX > btn1X && mouseX < btn1X + baseW && mouseY > btn1Y && mouseY < btn1Y + baseH;

      let btn2W = 160;
      let btn2H = infoBtnImg ? infoBtnImg.height * (btn2W / infoBtnImg.width) : 35;
      let btn2X = btn1X + baseW - btn2W; 
      let btn2Y = btn1Y + baseH + 10;
      let isHover2 = mouseX > btn2X && mouseX < btn2X + btn2W && mouseY > btn2Y && mouseY < btn2Y + btn2H;

      if (isHover1 || isHover2) cursor(HAND);
      else cursor(ARROW);

      let finalW1 = isHover1 ? baseW * 1.05 : baseW;
      let finalH1 = isHover1 ? baseH * 1.05 : baseH;
      if (btnImg) image(btnImg, btn1X - (finalW1-baseW)/2, btn1Y - (finalH1-baseH)/2, finalW1, finalH1);

      let finalW2 = isHover2 ? btn2W * 1.05 : btn2W;
      let finalH2 = infoBtnImg ? infoBtnImg.height * (finalW2 / infoBtnImg.width) : btn2H;
      if (infoBtnImg) image(infoBtnImg, btn2X - (finalW2-btn2W)/2, btn2Y - (finalH2-btn2H)/2, finalW2, finalH2);

    } else if (gameState === "INFO") {
      if (infoBgImg) image(infoBgImg, 100, 100, width - 200, height - 200);
      else { fill(0,0,0,200); rect(100,100, width-200, height-200, 20); }

      fill(101,67,33);
      textAlign(CENTER);
      textSize(24);
      textAlign(LEFT);
      let infoText = "1. 觀察畫面中央出現的乘法魔法題。\n" +
                     "2. 使用食指與大拇指在空中「捏合」來抓取答案卡。\n" +
                     "3. 將正確答案拖曳至下方的「回答魔法陣」。\n" +
                     "4. 答對可削減怪物 HP，將其擊敗獲得高分！";
      text(infoText, width/2 - 250, height/2 - 50);

      let backBtnX = width/2 - 100;
      let backBtnY = height - 220;
      let isHoverBack = mouseX > backBtnX && mouseX < backBtnX + 200 && mouseY > backBtnY && mouseY < backBtnY + 60;
      if (isHoverBack) cursor(HAND); else cursor(ARROW);
      fill(isHoverBack ? 150 : 100, 50, 150);
      stroke(255);
      rect(backBtnX, backBtnY, 200, 60, 10);
      fill(255); noStroke(); textAlign(CENTER, CENTER); text("返回", width/2, backBtnY+30);

    } else if (gameState === "SELECT") {
      if (selectBgImg) image(selectBgImg, 0, 0, width, height);
      else background(30,30,60);

      let yMin = height * 0.25, yMax = height * 0.9;
      let isHoverMath = mouseX > width * 0.08 && mouseX < width * 0.29 && mouseY > yMin && mouseY < yMax;
      let isHoverLang = mouseX > width * 0.31 && mouseX < width * 0.51 && mouseY > yMin && mouseY < yMax;
      let isHoverSci  = mouseX > width * 0.53 && mouseX < width * 0.73 && mouseY > yMin && mouseY < yMax;
      let isHoverHist = mouseX > width * 0.75 && mouseX < width * 0.95 && mouseY > yMin && mouseY < yMax;
      if (isHoverMath || isHoverLang || isHoverSci || isHoverHist) cursor(HAND); else cursor(ARROW);

      let alpha = map(sin(millis() * 0.003), -1, 1, 100, 255);
      fill(255, alpha); noStroke(); textSize(24); textAlign(CENTER);
      text("請直接點選學院", width / 2, height - 50);
    }

  } else if (gameState === "PLAY") {
    background(20, 20, 40);
    push(); translate(width,0); scale(-1,1); image(video, 0,0, width, height); pop();
    fill(0,0,0,120); rect(0,0,width,height);
    drawUI();
  }

  // --- 2. 手勢偵測與骨架層 ---
  if (gameState === "SELECT" || gameState === "PLAY") {
    // 若沒有手勢資料，重置平滑與狀態，避免中途掉落
    if (hands.length === 0) {
      smoothedPinchDist = null;
      pinchHoldCounter = 0;
      pinchStable = false;
      // 若在拖曳中，取消拖曳以避免殘留
      // (可選擇不取消以允許短暫遮擋)
      // draggingCard = null;
    }

    drawHandSkeleton();

    let finger = getIndexFinger();
    let thumb = getThumbFinger();

    if (finger && thumb) {
      handLostTimer = 0;
      let keypoints = getCurrentKeypoints();
      let handSize = 100;
      if (keypoints.length > 9) handSize = dist(keypoints[0].x, keypoints[0].y, keypoints[9].x, keypoints[9].y);
      let pinchThreshold = max(30, handSize * 0.12);

      // 計算食指與拇指距離並做平滑
      let d = dist(finger.x, finger.y, thumb.x, thumb.y);
      if (smoothedPinchDist == null) smoothedPinchDist = d;
      smoothedPinchDist = lerp(smoothedPinchDist, d, pinchDistanceAlpha);

      // 原始判斷和持續計數（滯後）
      let isPinchedRaw = smoothedPinchDist < pinchThreshold;
      if (isPinchedRaw) pinchHoldCounter = min(pinchHoldThreshold, pinchHoldCounter + 1);
      else pinchHoldCounter = max(0, pinchHoldCounter - pinchDecay);

      // active: 還在維持 (用於持續拖曳)
      let activePinch = pinchHoldCounter > 0;
      // stable: 已達穩定閾值（用於開始抓取）
      let stablePinch = pinchHoldCounter >= pinchHoldThreshold;
      pinchStable = stablePinch;

      // 顯示指標（穩定綠、否則黃）
      fill(stablePinch ? color(0,255,0) : color(255,255,0)); noStroke(); circle(finger.x, finger.y, 20);
      if (gameState === "PLAY") handleCardDrag(finger, activePinch, stablePinch);
    } else if (gameState === "PLAY") {
      handLostTimer++;
      if (handLostTimer > 10) draggingCard = null;
    }
  }

  // --- 3. 轉場效果 ---
  handleTransition();
}

//========================
// UI
//========================
function drawUI(){
  fill(255); textAlign(CENTER); textSize(35); text(question, width/2, 50);

  // 怪物
  fill(150,50,200); ellipse(width/2, height/2, 180, 180);
  fill(255); textSize(24); text("怪物", width/2, height/2);

  // 血條
  fill(80); rect(width/2-100, height/2-130, 200, 20, 20);
  fill(255,0,0); rect(width/2-100, height/2-130, monsterHP*2, 20, 20);
  fill(255); textSize(18); text("HP:"+monsterHP, width/2, height/2-100);

  // 分數
  textAlign(LEFT); textSize(24); text("分數:"+score, 20,40);

  // 提示
  textAlign(CENTER); fill(255,230,100); textSize(20); text(message, width/2, height-30);

  // 答案卡
  for(let card of cards){
    fill(255,245,180); strokeWeight(3); stroke(180);
    rect(card.x, card.y, card.w, card.h, 15);
    fill(50); noStroke(); textSize(35);
    text(card.value, card.x+card.w/2, card.y+card.h/2+10);
  }

  // 回答格
  noFill(); strokeWeight(5); stroke(100,255,255);
  rect(answerBox.x, answerBox.y, answerBox.w, answerBox.h, 20);
  fill(180,255,255); noStroke(); textSize(20);
  text("回答魔法陣", answerBox.x+answerBox.w/2, answerBox.y+answerBox.h/2);
}

//========================
// 點擊事件：切換遊戲狀態
//========================
function mousePressed() {
  if (gameState === "START" && btnImg) {
    let baseW = 450;
    let baseH = btnImg.height * (baseW / btnImg.width);
    let floatY = sin(millis() * 0.002) * 10;
    let btn1X = width/2 - baseW/2;
    let btn1Y = height * 0.75 - 95 + floatY;

    if (mouseX > btn1X && mouseX < btn1X + baseW && mouseY > btn1Y && mouseY < btn1Y + baseH) {
      pendingState = "SELECT"; cursor(ARROW);
    }

    let btn2W = 160;
    let btn2H = infoBtnImg ? infoBtnImg.height * (btn2W / infoBtnImg.width) : 35;
    let btn2X = btn1X + baseW - btn2W;
    let btn2Y = btn1Y + baseH + 10;
    if (mouseX > btn2X && mouseX < btn2X + btn2W && mouseY > btn2Y && mouseY < btn2Y + btn2H) pendingState = "INFO";

  } else if (gameState === "INFO") {
    let backBtnX = width/2 - 100;
    let backBtnY = height - 220;
    if (mouseX > backBtnX && mouseX < backBtnX + 200 && mouseY > backBtnY && mouseY < backBtnY + 60) pendingState = "START";
  } else if (gameState === "SELECT") {
    let yMin = height * 0.25, yMax = height * 0.9;
    if (mouseY > yMin && mouseY < yMax) {
      if (mouseX > width * 0.08 && mouseX < width * 0.29) { selectedAcademy = "MATH"; pendingState = "PLAY"; }
      else if (mouseX > width * 0.31 && mouseX < width * 0.51) { selectedAcademy = "LANG"; pendingState = "PLAY"; }
      else if (mouseX > width * 0.53 && mouseX < width * 0.73) { selectedAcademy = "SCIENCE"; pendingState = "PLAY"; }
      else if (mouseX > width * 0.75 && mouseX < width * 0.95) { selectedAcademy = "HISTORY"; pendingState = "PLAY"; }
      if (pendingState === "PLAY") cursor(ARROW);
    }
  }
}

//========================
// 轉場
//========================
function handleTransition() {
  if (pendingState) {
    fadeAlpha += 15;
    if (fadeAlpha >= 255) {
      gameState = pendingState;
      if (gameState === "PLAY") newQuestion();
      pendingState = null;
    }
  } else {
    fadeAlpha = max(0, fadeAlpha - 15);
  }

  if (fadeAlpha > 0) { push(); fill(0, fadeAlpha); noStroke(); rect(0,0,width,height); pop(); }
}

//========================
// keypoints helpers
//========================
function getKeypoints(hand) {
  if (!hand) return [];
  if (hand.keypoints && hand.keypoints.length > 0) return hand.keypoints;
  if (hand.landmarks && hand.landmarks.length > 0) return hand.landmarks.map(pt => ({ x: pt[0], y: pt[1] }));
  return [];
}

function getSmoothedKeypoints(rawKeypoints) {
  if (!rawKeypoints) return [];
  if (!smoothedKeypoints || smoothedKeypoints.length !== rawKeypoints.length) {
    smoothedKeypoints = rawKeypoints.map(kp => ({ x: kp.x, y: kp.y }));
    return smoothedKeypoints;
  }
  for (let i = 0; i < rawKeypoints.length; i++) {
    let r = rawKeypoints[i];
    let s = smoothedKeypoints[i];
    s.x = lerp(s.x, r.x, smoothingAlpha);
    s.y = lerp(s.y, r.y, smoothingAlpha);
  }
  return smoothedKeypoints;
}

function getCurrentKeypoints() {
  if (hands.length === 0) return [];
  const hand = hands[0];
  // 檢查手勢偵測置信度（不同版本 key 名稱可能不同）
  const conf = (hand.handInViewConfidence !== undefined) ? hand.handInViewConfidence : (hand.score !== undefined ? hand.score : (hand.confidence !== undefined ? hand.confidence : 1));
  if (conf < minHandConfidence) {
    // 若置信度太低，不回傳 keypoints，避免誤判
    return [];
  }
  const raw = getKeypoints(hand);
  return getSmoothedKeypoints(raw);
}

function getThumbFinger() {
  let keypoints = getCurrentKeypoints();
  if (keypoints.length > 4) {
    let fingerPoint = keypoints[4];
    return { x: width - fingerPoint.x, y: fingerPoint.y };
  }
  return null;
}

function getIndexFinger() {
  let keypoints = getCurrentKeypoints();
  if (keypoints.length > 8) {
    let fingerPoint = keypoints[8];
    return { x: width - fingerPoint.x, y: fingerPoint.y };
  }
  return null;
}

//========================
// 畫手勢骨架
//========================
function drawHandSkeleton() {
  if (hands.length === 0) return;
  // 使用 raw (smoothed) keypoints，畫面鏡像使用 translate/scale
  let keypoints = getCurrentKeypoints();
  if (keypoints.length === 0) return;

  push(); translate(width,0); scale(-1,1);
  stroke(0,255,255); strokeWeight(2); noFill();
  let fingerPaths = [[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20],[5,9,13,17]];
  for (let path of fingerPaths) {
    beginShape();
    for (let idx of path) { let kp = keypoints[idx]; if (kp) vertex(kp.x, kp.y); }
    endShape();
  }
  noStroke(); fill(0,255,255);
  for (let kp of keypoints) circle(kp.x, kp.y, 10);
  pop();
}

//========================
// 拖曳答案卡
//========================
function handleCardDrag(finger, activePinch, stablePinch){
  if (draggingCard == null) {
    // 只有穩定捏合才會開始抓取
    if (stablePinch) {
      for (let card of cards) {
        if (finger.x > card.x && finger.x < card.x + card.w && finger.y > card.y && finger.y < card.y + card.h) { draggingCard = card; break; }
      }
    }
  } else {
    // 只要還在 activePinch（滯後）就維持拖曳
    if (activePinch) {
      draggingCard.x = finger.x - draggingCard.w/2;
      draggingCard.y = finger.y - draggingCard.h/2;
    } else {
      // 放開後才判定丟進魔法陣或彈回
      if (finger.x > answerBox.x && finger.x < answerBox.x + answerBox.w && finger.y > answerBox.y && finger.y < answerBox.y + answerBox.h) {
        checkAnswer(draggingCard);
      } else {
        draggingCard.x = draggingCard.originalX; draggingCard.y = draggingCard.originalY;
      }
      draggingCard = null;
    }
  }
}

//========================
// 出題
//========================
function newQuestion() {
  let answers = [];
  if (selectedAcademy === "MATH"){
    let a = floor(random(2,10)); let b = floor(random(2,10)); correctAnswer = a*b; question = a + " × " + b + " = ?";
    let w1 = correctAnswer + floor(random(1,5)); let w2 = correctAnswer - floor(random(1,5)); if (w2<=0) w2 = correctAnswer + 6;
    answers = [correctAnswer, w1, w2];
  } else if (selectedAcademy === "LANG"){
    let data = [{q:"Magic", a:"魔法", w:["科學","歷史"]},{q:"Apple", a:"蘋果", w:["香蕉","西瓜"]},{q:"Dragon", a:"巨龍", w:["鳳凰","獨角獸"]},{q:"School", a:"學校", w:["醫院","工廠"]}];
    let item = random(data); question = "翻譯咒語: " + item.q; correctAnswer = item.a; answers = [item.a, ...item.w];
  } else if (selectedAcademy === "SCIENCE"){
    let data = [{q:"H2O", a:"水", w:["氧氣","氫氣"]},{q:"O2", a:"氧氣", w:["二氧化碳","氮氣"]},{q:"NaCl", a:"食鹽", w:["糖","蘇打"]},{q:"CO2", a:"二氧化碳", w:["一氧化碳","氧氣"]}];
    let item = random(data); question = "探測物質: " + item.q + " 是？"; correctAnswer = item.a; answers = [item.a, ...item.w];
  } else if (selectedAcademy === "HISTORY"){
    let data = [{q:"秦始皇", a:"秦朝", w:["漢朝","唐朝"]},{q:"唐太宗", a:"唐朝", w:["宋朝","明朝"]},{q:"劉備", a:"三國", w:["晉朝","隋朝"]},{q:"漢武帝", a:"漢朝", w:["清朝","秦朝"]}];
    let item = random(data); question = "考證: " + item.q + " 所屬時代？"; correctAnswer = item.a; answers = [item.a, ...item.w];
  }

  answers = shuffle(answers);
  let startX = width/2 - 220; cards = [];
  for (let i=0;i<3;i++){
    cards.push({ x: startX + i*180, y:100, w:120, h:80, value:answers[i], originalX: startX + i*180, originalY:100 });
  }

  answerBox = { x: width/2-100, y: height-170, w:200, h:100 };
}

//========================
// 判斷答案
//========================
function checkAnswer(card){
  if (card.value === correctAnswer) {
    message = "數學魔法命中！";
    monsterHP -= 25; score += 10;
    if (monsterHP <= 0) { monsterHP = 100; message = "怪物被擊敗！"; }
    newQuestion();
  } else {
    message = "咒語失敗！";
    card.x = card.originalX; card.y = card.originalY;
  }
}

//========================
// 縮放
//========================
function windowResized(){ resizeCanvas(windowWidth, windowHeight); }

