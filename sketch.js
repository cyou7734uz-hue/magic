let video;
let handpose;
let hands = [];

let cards = [];
let answerBox;

let question;
let correctAnswer;

let selectedCard = null; // 目前被捏合選取中的卡片
let selectedCardPinched = false; // 只有捏合觸發的選取
let selectedCardState = 'idle'; // idle, dragging
let selectedCardOffset = { x: 0, y: 0 }; // 拖移時的抓握偏移
let hoveredCard = null;  // 目前手指指著的卡片
let handLostTimer = 0; // 防止偵測閃爍的計時器
let isResolving = false; // 避免判斷答案時重複觸發

let gameState = "START"; // START, SELECT, INFO, PLAY
let coverImg;
let btnImg;
let infoBtnImg;
let infoBgImg;
let selectBgImg;
let monsterImg;
let monsterImg2;
let victoryImg;
let playBgImg;
let monsterStage = 1; // 追蹤目前是第幾個怪物
let selectedAcademy = "MATH";
let fadeAlpha = 0;
let isPaused = false;
let pendingState = null;

let monsterVisualAlpha = 255; // 用於控制怪物被打敗時的透明度
let particles = []; // 粒子陣列
let monsterHP = 100;
let score = 0;
let screenShake = 0; // 畫面震動強度

let message = "用食指抓取答案卡，拖到魔法陣";

// 平滑與參數
let smoothedKeypoints = [];
let smoothingAlpha = 0.3; // 提高一點反應速度
// 捏合穩定性參數
let smoothedPinchDist = null;
let pinchDistanceAlpha = 0.25; // 平滑捏合距離 (較平滑)
let pinchHoldCounter = 0; // 當前捏合持續計數
let pinchHoldThreshold = 5; // 稍微降低門檻，選取更靈敏
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
  monsterImg = loadImage('圖/1.png');
  monsterImg2 = loadImage('圖/1-2.png');
  playBgImg = loadImage('圖/1-0.png');
  victoryImg = loadImage('圖/666.png');
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
  // 確保每一幀開始時濾鏡是乾淨的
  drawingContext.filter = 'none';

  // --- 1. 背景底圖層 ---
  if (gameState === "START" || gameState === "INFO" || gameState === "SELECT" || gameState === "VICTORY") {
    let currentBg = (gameState === "VICTORY" && victoryImg) ? victoryImg : coverImg;
    if (!currentBg) background(50);
    else image(currentBg, 0, 0, width, height);

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

      // 返回按鈕 (左上角)
      let selBackX = 30, selBackY = 30;
      let isHoverSelBack = mouseX > selBackX && mouseX < selBackX + 110 && mouseY > selBackY && mouseY < selBackY + 45;
      if (isHoverSelBack) cursor(HAND);
      fill(isHoverSelBack ? color(180, 60, 60) : color(120, 40, 40, 200));
      stroke(255); strokeWeight(2);
      rect(selBackX, selBackY, 100, 45, 10);
      fill(255); noStroke(); textAlign(CENTER, CENTER); textSize(20);
      text("返回", selBackX + 50, selBackY + 22);

    } else if (gameState === "VICTORY") {
      // 加入旋轉魔法陣光效，並處理返回時的淡出
      let vAlpha = 255;
      if (pendingState === "START") vAlpha = 255 - fadeAlpha;
      drawVictoryMagicCircle(width / 2, height / 2, vAlpha);

      fill(255);
      textAlign(CENTER, CENTER);
      textSize(32);
      text("你成功保衛了魔法學院，獲得分數：" + score, width / 2, height / 2 + 50);

      let backBtnX = width / 2 - 100;
      let backBtnY = height - 220;
      let isHoverBack = mouseX > backBtnX && mouseX < backBtnX + 200 && mouseY > backBtnY && mouseY < backBtnY + 60;
      if (isHoverBack) cursor(HAND); else cursor(ARROW);
      fill(isHoverBack ? color(100, 200, 100) : color(60, 150, 60));
      stroke(255);
      rect(backBtnX, backBtnY, 200, 60, 10);
      fill(255); noStroke(); text("回到首頁", width / 2, backBtnY + 30);

      // 撒花特效：在勝利畫面持續產生落下粒子
      if (frameCount % 2 === 0) {
        particles.push(new Particle(random(width), -20, false, true));
      }
    }

  } else if (gameState === "PLAY") {
    // 1. 使用 圖/1-0.png 作為遊戲背景
    if (playBgImg) {
      image(playBgImg, 0, 0, width, height);
    } else {
      background(20, 20, 40);
    }

    // --- 畫面震動特效 ---
    if (screenShake > 0) {
      translate(random(-screenShake, screenShake), random(-screenShake, screenShake));
      screenShake *= 0.85; // 震動衰減速度
      if (screenShake < 0.5) screenShake = 0;
    }

    // 2. 計算 70% 畫面大小與置中位置
    let vW = width * 0.7;
    let vH = height * 0.7;
    let vX = (width - vW) / 2;
    let vY = (height - vH) / 2;

    push(); 
    if (isPaused) {
      // 當暫停時，套用灰階與模糊濾鏡
      drawingContext.filter = 'grayscale(100%) blur(8px)';
    }
    // 鏡像且置中繪製 70% 大小的影片
    translate(vX + vW, vY); 
    scale(-1, 1); 
    image(video, 0, 0, vW, vH); 
    pop();
    drawingContext.filter = 'none'; // 重置濾鏡，確保 UI 不會被模糊
    fill(0,0,0,120); rect(0,0,width,height);
    drawUI();
  }

  // 更新並繪製粒子 (移至外部，讓所有狀態皆可顯示特效)
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // --- 2. 手勢偵測與骨架層 ---
  if (gameState === "SELECT" || gameState === "PLAY") {
    // 若沒有手勢資料或處於暫停狀態，重置平滑與狀態
    if (hands.length === 0) {
      smoothedPinchDist = null;
      pinchHoldCounter = 0;
      pinchStable = false;
      // 若在拖曳中，取消拖曳以避免殘留
      // (可選擇不取消以允許短暫遮擋)
      // draggingCard = null;
    }

    // 暫停時不顯示手勢與執行遊戲逻辑
    if (!isPaused) drawHandSkeleton();

    let finger = getIndexFinger();
    let thumb = getThumbFinger();

    // --- 遊戲互動核心：捏合拖曳邏輯 ---
    if (finger && thumb && !isPaused && !isResolving) {
      handLostTimer = 0;
      let keypoints = getCurrentKeypoints();
      let handSize = 100;
      if (keypoints.length > 9) handSize = dist(keypoints[0].x, keypoints[0].y, keypoints[9].x, keypoints[9].y);

      // 取得手腕與食指根部，用於相對距離判斷
      let wrist = getKeypoint(0);
      let indexMCP = getKeypoint(5);
      let pinchDistance = dist(finger.x, finger.y, thumb.x, thumb.y);
      let handScale = (wrist && indexMCP) ? dist(wrist.x, wrist.y, indexMCP.x, indexMCP.y) : null;
      let pinchThreshold = handScale ? handScale * 0.7 : 30;

      // 平滑捏合距離，避免閃爍
      if (smoothedPinchDist == null) smoothedPinchDist = pinchDistance;
      smoothedPinchDist = lerp(smoothedPinchDist, pinchDistance, pinchDistanceAlpha);

      let isPinchedNow = handScale ? smoothedPinchDist < pinchThreshold : false;
      if (isPinchedNow) pinchHoldCounter = min(pinchHoldThreshold, pinchHoldCounter + 1);
      else pinchHoldCounter = max(0, pinchHoldCounter - pinchDecay);

      pinchStable = pinchHoldCounter >= pinchHoldThreshold;
      let grabPoint = { x: (finger.x + thumb.x) / 2, y: (finger.y + thumb.y) / 2 };

      // 更新懸停狀態（僅視覺回饋）
      hoveredCard = null;
      if (!selectedCard) {
        for (let card of cards) {
          if (isInsideCard(grabPoint, card)) { hoveredCard = card; break; }
        }
      }

      // 顯示指標（穩定綠、否則黃）
      fill(pinchStable ? color(0,255,0) : color(255,255,0)); noStroke(); circle(grabPoint.x, grabPoint.y, 20);
      
      if (gameState === "PLAY") {
        if (!selectedCard && pinchStable && hoveredCard) {
          // 1. 只有捏合且在卡片範圍內才抓住
          selectedCard = hoveredCard;
          selectedCardOffset.x = grabPoint.x - selectedCard.x;
          selectedCardOffset.y = grabPoint.y - selectedCard.y;
          message = "抓住魔力了！";
        } else if (selectedCard) {
          if (pinchStable) {
            // 2. 捏合持續時移動
            selectedCard.x = grabPoint.x - selectedCardOffset.x;
            selectedCard.y = grabPoint.y - selectedCardOffset.y;
          } else {
            // 3. 放開捏合後停止移動並判定
            handleReleaseCard();
          }
        }
      }
    } else if (selectedCard) {
      // 如果手突然消失，也視為放開
      handLostTimer++;
      if (handLostTimer > 15) {
        handleReleaseCard();
      }
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

  let monsterFloat = sin(millis() * 0.002) * 15; // 計算緩慢上下擺動的位移

  // 當怪物被打敗時，在背後顯示旋轉魔法陣
  if (monsterHP <= 0) {
    drawVictoryMagicCircle(width / 2, height / 2 + monsterFloat, 255 - monsterVisualAlpha);
    monsterVisualAlpha = max(0, monsterVisualAlpha - 8); // 緩慢變透明
  }

  // 怪物 (將原本的圓圈改為圖片)
  let currentMonsterImg = (monsterStage === 1) ? monsterImg : monsterImg2;
  if (currentMonsterImg) {
    push();
    imageMode(CENTER);
    let x = width / 2;
    let y = height / 2 + monsterFloat;

    if (monsterHP <= 0) {
      tint(255, monsterVisualAlpha);
      let progress = (255 - monsterVisualAlpha) / 255;
      translate(x, y + progress * 100); // 增加下沉位移，使其沉入陣中
      rotate(progress * TWO_PI * 3);   // 旋轉三圈，營造吸入感
      scale(monsterVisualAlpha / 255); // 隨透明度縮小至 0
      image(currentMonsterImg, 0, 0, 400, 300);
    } else {
      image(currentMonsterImg, x, y, 400, 300);
    }
    pop();
  } else {
    fill(150,50,200); ellipse(width/2, height/2 + monsterFloat, 180, 180);
    fill(255); textSize(24); text("怪物", width/2, height/2 + monsterFloat);
  }

  // 血條
  fill(80); rect(width/2-100, height/2-130 + monsterFloat, 200, 20, 20);
  fill(255,0,0); rect(width/2-100, height/2-130 + monsterFloat, monsterHP*2, 20, 20);
  fill(255); textSize(18); text("HP:"+monsterHP, width/2, height/2-100 + monsterFloat);

  // 分數
  textAlign(LEFT); textSize(24); text("分數:"+score, 20,40);

  // 提示 (暫停時隱藏)
  if (!isPaused) {
  textAlign(CENTER); fill(255,230,100); textSize(20); text(message, width/2, height-30);
  }

  // 暫停按鈕
  let backBtnX = width - 130;
  let backBtnY = 20;
  let isHoverBack = mouseX > backBtnX && mouseX < backBtnX + 110 && mouseY > backBtnY && mouseY < backBtnY + 45;
  if (isHoverBack) cursor(HAND); fill(isHoverBack ? color(100, 100, 250) : color(50, 50, 150, 200)); stroke(255); strokeWeight(2);
  rect(backBtnX, backBtnY, 110, 45, 10);
  fill(255); noStroke(); textAlign(CENTER, CENTER); textSize(18);
  text(isPaused ? "繼續" : "暫停", backBtnX + 55, backBtnY + 22);

  // 答案卡
  for(let card of cards){
    let isHovered = hoveredCard === card;
    let isSelected = selectedCard === card;

    if (isSelected || isHovered) {
      // 發光效果
      push();
      noStroke();
      fill(100, 255, 255, 100);
      rect(card.x - 10, card.y - 10, card.w + 20, card.h + 20, 20);
      pop();
      stroke(0, 255, 255);
      strokeWeight(4);
    } else {
      stroke(180);
      strokeWeight(3);
    }
    
    fill(255,245,180);
    rect(card.x, card.y, card.w, card.h, 15);
    fill(50); noStroke(); textSize(35);
    text(card.value, card.x+card.w/2, card.y+card.h/2+10);
  }

  // 回答格
  noFill(); strokeWeight(5); stroke(100,255,255);
  rect(answerBox.x, answerBox.y, answerBox.w, answerBox.h, 20);
  fill(180,255,255); noStroke(); textSize(20);
  text("回答魔法陣", answerBox.x+answerBox.w/2, answerBox.y+answerBox.h/2);

  // 暫停遮罩與選單
  if (isPaused) {
    fill(0, 0, 0, 180);
    rect(0, 0, width, height);
    fill(255); textSize(50); textAlign(CENTER, CENTER);
    text("遊戲暫停", width/2, height/2 - 100);
    
    let menuX = width/2 - 100;
    let resumeY = height/2;
    let homeY = height/2 + 80;

    let hoverRes = mouseX > menuX && mouseX < menuX+200 && mouseY > resumeY && mouseY < resumeY+50;
    let hoverHome = mouseX > menuX && mouseX < menuX+200 && mouseY > homeY && mouseY < homeY+50;
    if (hoverRes || hoverHome) cursor(HAND);

    // 繼續按鈕
    fill(hoverRes ? color(100, 200, 100) : color(60, 150, 60)); stroke(255);
    rect(menuX, resumeY, 200, 50, 10);
    fill(255); noStroke(); textSize(24); text("繼續遊戲", width/2, resumeY + 25);

    // 回到封面按鈕
    fill(hoverHome ? color(200, 100, 100) : color(150, 60, 60)); stroke(255);
    rect(menuX, homeY, 200, 50, 10);
    fill(255); noStroke(); textSize(24); text("回到封面", width/2, homeY + 25);
  }
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
    let selBackX = 30, selBackY = 30;
    if (mouseX > selBackX && mouseX < selBackX + 110 && mouseY > selBackY && mouseY < selBackY + 45) {
      pendingState = "START";
    }
    let yMin = height * 0.25, yMax = height * 0.9;
    if (mouseY > yMin && mouseY < yMax) {
      if (mouseX > width * 0.08 && mouseX < width * 0.29) { selectedAcademy = "MATH"; pendingState = "PLAY"; }
      else if (mouseX > width * 0.31 && mouseX < width * 0.51) { selectedAcademy = "LANG"; pendingState = "PLAY"; }
      else if (mouseX > width * 0.53 && mouseX < width * 0.73) { selectedAcademy = "SCIENCE"; pendingState = "PLAY"; }
      else if (mouseX > width * 0.75 && mouseX < width * 0.95) { selectedAcademy = "HISTORY"; pendingState = "PLAY"; }
      if (pendingState === "PLAY") cursor(ARROW);
    }
  } else if (gameState === "PLAY") {
    let backBtnX = width - 130;
    let backBtnY = 20;
    
    // 判斷是否點擊右上角暫停/繼續
    if (mouseX > backBtnX && mouseX < backBtnX + 110 && mouseY > backBtnY && mouseY < backBtnY + 45) {
      isPaused = !isPaused;
    } else if (isPaused) {
      // 暫停選單中的按鈕
      let menuX = width/2 - 100;
      if (mouseX > menuX && mouseX < menuX + 200) {
        if (mouseY > height/2 && mouseY < height/2 + 50) {
          isPaused = false; // 繼續
        } else if (mouseY > height/2 + 80 && mouseY < height/2 + 130) {
          isPaused = false;
          pendingState = "START"; // 回封面
        }
      }
    }
  } else if (gameState === "VICTORY") {
    let backBtnX = width / 2 - 100;
    let backBtnY = height - 220;
    if (mouseX > backBtnX && mouseX < backBtnX + 200 && mouseY > backBtnY && mouseY < backBtnY + 60) pendingState = "START";
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
      if (gameState === "START") {
        monsterHP = 100;
        monsterStage = 1;
        score = 0;
        monsterVisualAlpha = 255;
        isPaused = false;
        particles = []; // 回到首頁時清空粒子
      }
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

function mapKeypointToCanvas(kp) {
  // 將原本 100% 偵測區域的點，轉換為 70% 置中區域的坐標
  let vW = width * 0.7;
  let vH = height * 0.7;
  let vX = (width - vW) / 2;
  let vY = (height - vH) / 2;
  return {
    x: vX + (width - kp.x) * 0.7,
    y: vY + kp.y * 0.7
  };
}

function getThumbFinger() {
  let keypoints = getCurrentKeypoints();
  if (keypoints.length > 4) {
    return mapKeypointToCanvas(keypoints[4]);
  }
  return null;
}

function getIndexFinger() {
  let keypoints = getCurrentKeypoints();
  if (keypoints.length > 8) {
    return mapKeypointToCanvas(keypoints[8]);
  }
  return null;
}

function getKeypoint(index) {
  let keypoints = getCurrentKeypoints();
  if (keypoints.length > index) {
    return mapKeypointToCanvas(keypoints[index]);
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

  let vW = width * 0.7;
  let vH = height * 0.7;
  let vX = (width - vW) / 2;
  let vY = (height - vH) / 2;

  // 更新骨架繪製位置，使其對齊 70% 的影片區域
  push(); translate(vX + vW, vY); scale(-0.7, 0.7);
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
// 輔助函式
//========================
function handleReleaseCard() {
  if (!selectedCard) return;
  
  let cardCenterX = selectedCard.x + selectedCard.w / 2;
  let cardCenterY = selectedCard.y + selectedCard.h / 2;
  let inAnswerBox = cardCenterX > answerBox.x && cardCenterX < answerBox.x + answerBox.w &&
                    cardCenterY > answerBox.y && cardCenterY < answerBox.y + answerBox.h;

  if (inAnswerBox) {
    checkAnswer(selectedCard);
  } else {
    // 5. 不在魔法陣內回到原位
    selectedCard.x = selectedCard.originalX;
    selectedCard.y = selectedCard.originalY;
  }
  selectedCard = null;
}

function isInsideCard(point, card) {
  return point.x > card.x && point.x < card.x + card.w &&
         point.y > card.y && point.y < card.y + card.h;
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

  answerBox = { x: width/2 - 150, y: height - 220, w: 300, h: 150 };
}

//========================
// 判斷答案
//========================
function checkAnswer(card){
  if (isResolving) return;
  isResolving = true;

  if (card.value === correctAnswer) {
    message = "數學魔法命中！";
    monsterHP -= 25; score += 10;
    screenShake = 10; // 答對命中時產生的輕微震動

    // 產生爆炸粒子
    let monsterFloat = sin(millis() * 0.002) * 15;
    for (let i = 0; i < 40; i++) {
      particles.push(new Particle(width / 2, height / 2 + monsterFloat));
    }

    if (monsterHP <= 0) { 
      // 產生死亡大爆炸特效 (數量更多、尺寸更大、顏色不同)
      for (let i = 0; i < 150; i++) {
        particles.push(new Particle(width / 2, height / 2 + monsterFloat, true));
      }

      // 增加延遲，讓怪物敗北動畫播完再切換狀態
      let defeatDelay = 1500; 
      setTimeout(() => {
        if (monsterStage === 1) {
          monsterStage = 2;
          monsterHP = 100;
          monsterVisualAlpha = 255; // 重置下一隻怪物的透明度
          message = "第一隻怪物倒下了！第二隻出現了！";
          screenShake = 30;
          newQuestion();
        } else {
          pendingState = "VICTORY";
        }
        isResolving = false;
      }, defeatDelay);
      return; // 攔截下方的預設 setTimeout
    }
    
    // 延遲一點點時間再出新題目，讓玩家看清楚命中效果
    setTimeout(() => {
      newQuestion();
      isResolving = false;
    }, 500);
  } else {
    message = "咒語失敗！";
    card.x = card.originalX; card.y = card.originalY;
    isResolving = false;
  }
}

//========================
// 縮放
//========================
function windowResized(){ resizeCanvas(windowWidth, windowHeight); }

//========================
// 粒子類別 (用於魔法命中特效)
//========================
class Particle {
  constructor(x, y, isSuper = false, isConfetti = false) {
    this.pos = createVector(x, y);
    this.isConfetti = isConfetti;

    if (this.isConfetti) {
      // 撒花模式：隨機向下移動，帶有輕微左右晃動
      this.vel = createVector(random(-2, 2), random(1, 4));
      this.lifespan = 255;
      this.size = random(8, 20);
      // 金色、黃色與隨機繽紛色
      let r = random(1);
      if (r < 0.6) this.color = [255, 215, random(0, 50)]; // 金色系
      else if (r < 0.8) this.color = [255, 255, 255]; // 白色
      else this.color = [random(255), random(255), random(255)]; // 彩色
    } else {
    // 隨機向四周發散，大爆炸 (isSuper) 時速度與動量更大
    let maxVel = isSuper ? 22 : 12;
    this.vel = p5.Vector.random2D().mult(random(3, maxVel));
    this.lifespan = 255;
    this.size = isSuper ? random(10, 40) : random(6, 18);
    if (isSuper) {
      // 死亡大爆炸顏色：青色、紫色與純白交織 (魔法感)
      let r = random(1);
      if (r < 0.4) this.color = [0, 255, 255]; // Cyan
      else if (r < 0.8) this.color = [180, 100, 255]; // Purple
      else this.color = [255, 255, 255]; // White
    } else {
      // 普通命中顏色：從白色到金黃、橘色隨機
      this.color = [255, random(180, 255), random(0, 100)];
    }
    }
  }

  update() {
    this.pos.add(this.vel);
    if (this.isConfetti) {
      this.vel.y += 0.05; // 重力效果
      this.lifespan -= 1.5; // 較慢的消失速度
    } else {
      this.vel.mult(0.92); // 模擬空氣阻力
      this.lifespan -= 8;   // 快速淡出
    }
  }

  display() {
    noStroke();
    fill(this.color[0], this.color[1], this.color[2], this.lifespan);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.lifespan < 0;
  }
}

//========================
// 勝利畫面專用的旋轉魔法陣
//========================
function drawVictoryMagicCircle(x, y, opacity = 255) {
  push();
  translate(x, y);
  
  let rot = frameCount * 0.01;
  noFill();
  let aScale = opacity / 255; // 用於計算所有顏色的透明度比例
  
  // 外圈呼吸光環
  for (let i = 0; i < 5; i++) {
    stroke(180, 100, 255, (40 - i * 8) * aScale);
    strokeWeight(4);
    ellipse(0, 0, 450 + i * 10 + sin(frameCount * 0.02) * 20);
  }
  
  // 六角幾何底陣 - 增加層次感
  stroke(0, 255, 255, 40 * aScale);
  strokeWeight(1);
  push();
  rotate(rot * 0.2);
  for(let i = 0; i < 2; i++) {
    rotate(PI / 3);
    rectMode(CENTER);
    rect(0, 0, 310, 310);
  }
  pop();

  // 符文細節層 - 增加神祕的虛線圈
  stroke(180, 100, 255, 80 * aScale);
  strokeWeight(1);
  drawingContext.setLineDash([10, 15]);
  push();
  rotate(rot * 0.5);
  ellipse(0, 0, 440);
  rotate(-rot * 0.8);
  ellipse(0, 0, 390);
  pop();
  drawingContext.setLineDash([]); // 重置虛線設定

  // 旋轉的主圓環
  rotate(rot);
  stroke(180, 100, 255, 180 * aScale);
  strokeWeight(2);
  ellipse(0, 0, 420);
  
  // 符文刻線與點點裝飾 (12方位)
  for(let i = 0; i < 12; i++) {
    rotate(TWO_PI / 12);
    stroke(0, 255, 255, 150 * aScale);
    line(185, 0, 210, 0); 
    // 方位符文框 (每 90 度出現一個)
    if (i % 3 === 0) {
      rectMode(CENTER);
      noFill();
      rect(250, 0, 15, 15);
    }
    noStroke();
    fill(0, 255, 255, 120 * aScale);
    circle(225, 0, 4);
  }

  // 內部的幾何三角陣 (反向旋轉)
  rotate(-rot * 1.5);
  noFill();
  stroke(0, 255, 255, 120 * aScale);
  for(let i = 0; i < 3; i++) {
    rotate(TWO_PI / 3);
    strokeWeight(2);
    triangle(-150, 80, 150, 80, 0, -180);
    // 核心能量連接線
    line(0, 0, 0, -80);
    // 內部的圓形符文
    strokeWeight(1);
    ellipse(0, -110, 35);
  }
  pop();
}
