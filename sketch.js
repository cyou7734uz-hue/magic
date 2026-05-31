let video;
let handpose;
let hands = [];

let cards = [];
let answerBox;

let question;
let correctAnswer;

let draggingCard = null;
let handLostTimer = 0; // 新增：防止偵測閃爍的計時器

let gameState = "START"; // 遊戲狀態：START (封面) 或 PLAY (遊戲中)
let coverImg;
let btnImg;
let infoBtnImg;
let infoBgImg; // 新增說明畫面底圖變數

let monsterHP = 100;
let score = 0;

let message = "用食指抓取答案卡，拖到魔法陣";


//========================
// 載入模型
//========================

function preload() {
  coverImg = loadImage('封面/封面底圖.png');
  btnImg = loadImage('封面/進入.png');
  infoBtnImg = loadImage('封面/說明.png');
  infoBgImg = loadImage('封面/說明底圖.png'); // 載入說明底圖
}


//========================
// 建立畫面
//========================

function setup(){

createCanvas(windowWidth,windowHeight);

video = createCapture(VIDEO);
video.size(width, height);
video.hide();

handpose = ml5.handPose(video, modelReady);
// ml5 v1 新版語法：使用 detectStart 開始持續偵測
handpose.detectStart(video, gotHands);

newQuestion();

}


//========================
// 接收手勢結果
//========================

function gotHands(results){
  hands = results;
}

function modelReady() {
  console.log("Handpose model ready");
  let loading = document.getElementById("loading");
  if (loading) {
    loading.style.display = "none";
  }
}


//========================
// 主迴圈
//========================

function draw(){

if (gameState === "START" || gameState === "INFO") {
  // 繪製封面
  if (!coverImg) {
    background(50); // 若圖片載入失敗，顯示深灰色背景避免當機
  }
  image(coverImg, 0, 0, width, height);

  let floatY = sin(millis() * 0.002) * 10;
  let baseW = 450; // 加大主按鈕 (原本 300)
  let baseH = btnImg ? btnImg.height * (baseW / btnImg.width) : 80;

  if (gameState === "START") {
    // --- 1. 進入遊戲按鈕 (恢復置中) ---
    let btn1X = width/2 - baseW/2;
    let btn1Y = height * 0.75 - 95 + floatY;
    let isHover1 = mouseX > btn1X && mouseX < btn1X + baseW && mouseY > btn1Y && mouseY < btn1Y + baseH;
    
    // --- 2. 遊戲說明按鈕 (右下角，縮小，改用圖片) ---
    let btn2W = 160; // 加大說明按鈕 (原本 100)
    let btn2H = infoBtnImg ? infoBtnImg.height * (btn2W / infoBtnImg.width) : 35;
    let btn2X = btn1X + baseW - btn2W; 
    let btn2Y = btn1Y + baseH + 10;
    let isHover2 = mouseX > btn2X && mouseX < btn2X + btn2W && mouseY > btn2Y && mouseY < btn2Y + btn2H;

    if (isHover1 || isHover2) cursor(HAND);
    else cursor(ARROW);

    // 繪製按鈕 1 (圖片)
    let finalW1 = isHover1 ? baseW * 1.05 : baseW;
    let finalH1 = isHover1 ? baseH * 1.05 : baseH;
    if (btnImg) {
      image(btnImg, btn1X - (finalW1-baseW)/2, btn1Y - (finalH1-baseH)/2, finalW1, finalH1);
    }

    // 繪製按鈕 2 (圖片)
    let finalW2 = isHover2 ? btn2W * 1.05 : btn2W;
    let finalH2 = infoBtnImg ? infoBtnImg.height * (finalW2 / infoBtnImg.width) : btn2H;
    
    if (infoBtnImg) {
      image(infoBtnImg, btn2X - (finalW2-btn2W)/2, btn2Y - (finalH2-btn2H)/2, finalW2, finalH2);
    }

  } else if (gameState === "INFO") {
    // --- 說明畫面內容 ---
    if (infoBgImg) {
      image(infoBgImg, 100, 100, width - 200, height - 200); // 使用圖片作為背景
    } else {
      fill(0, 0, 0, 200);
      rect(100, 100, width - 200, height - 200, 20);
    }
    fill(101, 67, 33); // 改為咖啡色，配合羊皮紙底圖質感
    textAlign(CENTER);
    
    textSize(24);
    textAlign(LEFT);
    let infoText = "1. 觀察畫面中央出現的乘法魔法題。\n" +
                   "2. 使用食指與大拇指在空中「捏合」來抓取答案卡。\n" +
                   "3. 將正確答案拖曳至下方的「回答魔法陣」。\n" +
                   "4. 答對可削減怪物 HP，將其擊敗獲得高分！";
    text(infoText, width/2 - 250, height/2 - 50);

    // 返回按鈕
    let backBtnX = width/2 - 100;
    let backBtnY = height - 220;
    let isHoverBack = mouseX > backBtnX && mouseX < backBtnX + 200 && mouseY > backBtnY && mouseY < backBtnY + 60;
    
    if (isHoverBack) cursor(HAND);
    else cursor(ARROW);

    fill(isHoverBack ? 150 : 100, 50, 150);
    stroke(255);
    rect(backBtnX, backBtnY, 200, 60, 10);
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    text("返回", width/2, backBtnY + 30);
  }

  return; // 跳出 draw，不執行後續遊戲邏輯
}

background(20,20,40);

// 1. 繪製視訊與骨架
push(); // 儲存目前的繪圖狀態
translate(width, 0); // 將原點移動到畫布右側
scale(-1, 1); // 水平翻轉畫布
image( // 繪製視訊，現在會是非鏡像的
video,
0,
0,
width,
height
);
pop(); // 恢復原始繪圖狀態

drawHandSkeleton();

// 2. 非鏡像 UI 繪製
fill(0,0,0,120);
rect(
0,
0,
width,
height
);

drawUI();

let finger = getIndexFinger();
let thumb = getThumbFinger();

if (finger && thumb) {
  handLostTimer = 0; // 偵測到手，重置計時器
  // 計算食指與大拇指的距離
  let d = dist(finger.x, finger.y, thumb.x, thumb.y);
  let isPinched = d < 50; // 稍微放寬門檻到 50 像素，增加成功率

  if (isPinched) {
    fill(0, 255, 0); // 捏合時顯示綠色
  } else {
    fill(255, 255, 0); // 未捏合顯示黃色
  }
  circle(finger.x, finger.y, 20);
  handleCardDrag(finger, isPinched);
} else {
  // 即使失去偵測，也多等 10 幀才放開，防止畫面閃爍導致掉卡
  handLostTimer++;
  if (handLostTimer > 10) {
    draggingCard = null;
  }
}
}


//========================
// UI
//========================

function drawUI(){

fill(255);

textAlign(CENTER);

textSize(35);

text(
question,
width/2,
50
);


//怪物

fill(150,50,200);

ellipse(
width/2,
height/2,
180,
180
);

fill(255);

textSize(24);

text(
"怪物",
width/2,
height/2
);


//血條

fill(80);

rect(
width/2-100,
height/2-130,
200,
20,
20
);

fill(255,0,0);

rect(
width/2-100,
height/2-130,
monsterHP*2,
20,
20
);

fill(255);

textSize(18);

text(
"HP:"+monsterHP,
width/2,
height/2-100
);


//分數

textAlign(LEFT);

textSize(24);

text(
"分數:"+score,
20,
40
);


//提示

textAlign(CENTER);

fill(255,230,100);

textSize(20);

text(
message,
width/2,
height-30
);


//答案卡

for(let card of cards){

fill(255,245,180);

strokeWeight(3);

stroke(180);

rect(

card.x,
card.y,

card.w,
card.h,

15

);

fill(50);

noStroke();

textSize(35);

text(

card.value,

card.x+
card.w/2,

card.y+
card.h/2+10

);

}

//回答格

noFill();

strokeWeight(5);

stroke(
100,
255,
255
);

rect(

answerBox.x,
answerBox.y,

answerBox.w,
answerBox.h,

20

);

fill(180,255,255);

noStroke();

textSize(20);

text(

"回答魔法陣",

answerBox.x+
answerBox.w/2,

answerBox.y+
answerBox.h/2

);

}

//========================
// 點擊事件：切換遊戲狀態
//========================
function mousePressed() {
  if (gameState === "START" && btnImg) {
    let baseW = 450; // 同步加大判定範圍
    let baseH = btnImg.height * (baseW / btnImg.width);
    let floatY = sin(millis() * 0.002) * 10;

    // 進入遊戲按鈕判定
    let btn1X = width/2 - baseW/2;
    let btn1Y = height * 0.75 - 95 + floatY;

    if (mouseX > btn1X && mouseX < btn1X + baseW &&
        mouseY > btn1Y && mouseY < btn1Y + baseH) {
      gameState = "PLAY";
      cursor(ARROW); // 進入遊戲時將游標恢復原狀
    }

    // 遊戲說明按鈕判定
    let btn2W = 160; // 同步加大判定範圍
    let btn2H = infoBtnImg ? infoBtnImg.height * (btn2W / infoBtnImg.width) : 35;
    let btn2X = btn1X + baseW - btn2W;
    let btn2Y = btn1Y + baseH + 10;
    if (mouseX > btn2X && mouseX < btn2X + btn2W &&
        mouseY > btn2Y && mouseY < btn2Y + btn2H) {
      gameState = "INFO";
    }
  } else if (gameState === "INFO") {
    // 返回按鈕判定
    let backBtnX = width/2 - 100;
    let backBtnY = height - 220;
    if (mouseX > backBtnX && mouseX < backBtnX + 200 &&
        mouseY > backBtnY && mouseY < backBtnY + 60) {
      gameState = "START";
    }
  }
}

function getThumbFinger() {
  if (hands.length > 0) {
    let hand = hands[0];
    // 大拇指尖端索引為 4
    let fingerPoint = hand.keypoints[4];
    return {
      x: width - fingerPoint.x, // 反轉 X 軸對應鏡像畫面
      y: fingerPoint.y
    };
  }

  return null;
}


//========================
// 出題
//========================

function newQuestion(){

let a=floor(random(2,10));

let b=floor(random(2,10));

correctAnswer=a*b;

question=a+
" × "+
b+
" = ?";


let wrong1=

correctAnswer+
floor(random(1,5));


let wrong2=

correctAnswer-
floor(random(1,5));


if(wrong2<=0){

wrong2=

correctAnswer+
6;

}


let answers=

shuffle([

correctAnswer,
wrong1,
wrong2

]);

let startX = width / 2 - 220; // 根據螢幕寬度動態計算起始 X

cards=[];


for(

let i=0;
i<3;
i++

){

cards.push({

x:startX + i*180,

y:100,

w:120,

h:80,

value:answers[i],

originalX:startX + i*180,

originalY:100

});

}


answerBox={

x:width/2-100,

y:height-170,

w:200,

h:100

};

}


//========================
// 食指位置
//========================

function getIndexFinger() {
  if (hands.length > 0) {
    let hand = hands[0];
    // ml5 v1 新版資料結構：使用 keypoints 陣列，索引 8 是食指尖端
    // keypoint 是包含 x, y 屬性的物件
    let fingerPoint = hand.keypoints[8];
    return {
      x: width - fingerPoint.x, // 反轉 X 軸對應鏡像畫面
      y: fingerPoint.y
    };
  }

  return null;
}


//========================
// 畫手勢骨架
//========================

function drawHandSkeleton() {
  if (hands.length === 0) {
    return;
  }

  let hand = hands[0];

  push();
  translate(width, 0);
  scale(-1, 1);

  // 1. 繪製骨架連接線
  stroke(0, 255, 255);
  strokeWeight(2);
  noFill();

  // 定義手指的連接路徑 (索引參考 MediaPipe 手勢模型)
  let fingerPaths = [
    [0, 1, 2, 3, 4],    // 大拇指
    [0, 5, 6, 7, 8],    // 食指
    [0, 9, 10, 11, 12],  // 中指
    [0, 13, 14, 15, 16], // 無名指
    [0, 17, 18, 19, 20], // 小指
    [5, 9, 13, 17]       // 掌心/指根連線
  ];

  for (let path of fingerPaths) {
    beginShape();
    for (let index of path) {
      let kp = hand.keypoints[index];
      vertex(kp.x, kp.y);
    }
    endShape();
  }

  // 2. 繪製關鍵點
  noStroke();
  fill(0, 255, 255);
  for (let i = 0; i < hand.keypoints.length; i++) {
    let keypoint = hand.keypoints[i];
    circle(keypoint.x, keypoint.y, 10);
  }

  pop();
}


//========================
// 拖曳答案卡
//========================

function handleCardDrag(
  finger,
  isPinched
){
  if (draggingCard == null) {
    // 尚未抓取卡片：必須在「捏合」狀態且手指在卡片範圍內才觸發抓取
    if (isPinched) {
      for (let card of cards) {
        if (
          finger.x > card.x &&
          finger.x < card.x + card.w &&
          finger.y > card.y &&
          finger.y < card.y + card.h
        ) {
          draggingCard = card;
          break;
        }
      }
    }
  } else {
    // 正在拖曳中
    if (isPinched) {
      // 持續捏合：更新卡片位置跟隨手指
      draggingCard.x = finger.x - draggingCard.w / 2;
      draggingCard.y = finger.y - draggingCard.h / 2;
    } else {
      // 放開捏合（Drop）：檢查是否丟進回答魔法陣
      if (
        finger.x > answerBox.x &&
        finger.x < answerBox.x + answerBox.w &&
        finger.y > answerBox.y &&
        finger.y < answerBox.y + answerBox.h
      ) {
        checkAnswer(draggingCard);
      } else {
        // 沒丟進魔法陣，卡片彈回原位
        draggingCard.x = draggingCard.originalX;
        draggingCard.y = draggingCard.originalY;
      }
      draggingCard = null;
    }
  }
}


//========================
// 判斷答案
//========================

function checkAnswer(

card

){

if(

card.value===correctAnswer

){

message=

"數學魔法命中！";

monsterHP-=25;

score+=10;


if(

monsterHP<=0

){

monsterHP=100;

message=

"怪物被擊敗！";

}


newQuestion();

}

else{

message=

"咒語失敗！";


card.x=

card.originalX;

card.y=

card.originalY;

}

}


//========================
// 自動縮放
//========================

function windowResized(){

resizeCanvas(

windowWidth,
windowHeight

);

}