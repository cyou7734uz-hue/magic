let video;
let handpose;
let hands = [];

let cards = [];
let answerBox;

let question;
let correctAnswer;

let draggingCard = null;
let handLostTimer = 0; // 新增：防止偵測閃爍的計時器

let monsterHP = 100;
let score = 0;

let message = "用食指抓取答案卡，拖到魔法陣";


//========================
// 載入模型
//========================

function preload() {
  // 目前改為 setup() 中載入手勢模型
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