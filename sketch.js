let video;
let handpose;
let hands = [];

let cards = [];
let answerBox;

let question;
let correctAnswer;

let draggingCard = null;

let monsterHP = 100;
let score = 0;

let message = "用食指抓取答案卡，拖到魔法陣";


//========================
// 載入模型
//========================

function preload(){

handpose=ml5.handPose();

}


//========================
// 建立畫面
//========================

function setup(){

createCanvas(windowWidth,windowHeight);

video=createCapture(VIDEO);

video.size(width,height);

video.hide();

handpose.detectStart(
video,
gotHands
);

newQuestion();

}


//========================
// 接收手勢結果
//========================

function gotHands(results){

hands=results;

}


//========================
// 主迴圈
//========================

function draw(){

push(); // 儲存當前繪圖狀態
translate(width, 0); // 將原點移動到畫布右側
scale(-1, 1); // 沿著 Y 軸翻轉，實現鏡像效果

background(20,20,40);

image(
video,
0,
0,
width,
height
);

fill(0,0,0,120);

rect(
0,
0,
width,
height
);

drawUI();

drawHandSkeleton();

let finger=getIndexFinger();

if(finger){

fill(255,255,0);

circle(
finger.x,
finger.y,
20
);

handleCardDrag(
finger
);

}

pop(); // 恢復之前的繪圖狀態

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


cards=[];


for(

let i=0;
i<3;
i++

){

cards.push({

x:220+i*180,

y:100,

w:120,

h:80,

value:answers[i],

originalX:220+i*180,

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

function getIndexFinger(){

if(

hands.length>0

){

let finger=

hands[0].index_finger_tip; // 由於整個畫面已經鏡像，這裡不需要再反轉 X 軸

return{

x:finger.x,

y:finger.y

};

}

return null;

}


//========================
// 畫手勢骨架
//========================

function drawHandSkeleton(){

if(

hands.length===0

){

return;

}


let hand=

hands[0];


for(

let key in hand.keypoints

){

let p=

hand.keypoints[key];

fill(

0, // 由於整個畫面已經鏡像，這裡不需要再反轉 X 軸
255,
255
);

circle(

p.x,
p.y,
10

);

}


let lines=[

["thumb_tip","thumb_ip"],

["thumb_ip","thumb_mcp"],

["index_finger_tip","index_finger_dip"],

["index_finger_dip","index_finger_pip"],

["index_finger_pip","index_finger_mcp"],

["middle_finger_tip","middle_finger_dip"],

["middle_finger_dip","middle_finger_pip"],

["ring_finger_tip","ring_finger_dip"],

["pinky_finger_tip","pinky_finger_dip"]

];


stroke(

0,
255,
255

);

strokeWeight(3);


for(

let l of lines

){

let a=

hand[l[0]];

let b=

hand[l[1]];

if(

a&&b // 由於整個畫面已經鏡像，這裡不需要再反轉 X 軸

){

line(

a.x,
a.y,

b.x,
b.y

);

}

}

}


//========================
// 拖曳答案卡
//========================

function handleCardDrag(

finger

){

if(

draggingCard==null

){

for(

let card of cards

){

if(

finger.x>

card.x

&&

finger.x<

card.x+
card.w

&&

finger.y>

card.y

&&

finger.y<

card.y+
card.h

){

draggingCard=

card;

break;

}

}

}


if(

draggingCard

){

draggingCard.x=

finger.x-

draggingCard.w/2;


draggingCard.y=

finger.y-

draggingCard.h/2;


if(

finger.x>

answerBox.x

&&

finger.x<

answerBox.x+
answerBox.w

&&

finger.y>

answerBox.y

&&

finger.y<

answerBox.y+
answerBox.h

){

checkAnswer(

draggingCard

);

draggingCard=null;

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