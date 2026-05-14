/*
  魚價計算要改三個地方
  initializeGame
  executeTurn
  resumeGame
*/

// File: mainlib.js
// Author: Mike Gildersleeve
// Copyright 2004, 2008 Dennis L. Meadows
//
// Overview:
// The central module of JavaScript for the Fishbanks program. As the external
// JavaScript file for the frameset, the globals and functions contained within
// are available as needed to any of the Fishbanks pages. As such, it acts as a
// centralized repository of common data and shared code.
//
// Revision History:
//   8/22/2004   Version 8.0
//     Initial release
//   2/11/2008   Version 8.01
//     Modified first year catch per ship in the deep sea to a constant value of 25
//   7/13/2008   Version 8.02
//     Fixed path names throughout to address folder name dependencies that were
//     preventing the program from running in some installations

function Storage(){
  this.data = {};
}
Storage.prototype.setItem = function (itemIdex, item) {
  this.data[itemIdex] = item;
};
Storage.prototype.getItem = function (itemIdex) {
  return this.data[itemIdex];
};
myStorage = new Storage();
// myStorage = (typeof(myStorage) === 'undefined' ? new Storage() : myStorage);
// myStorage = localStorage;

// Global scalars
var teams              = 4;			// Number of teams playing
var session = '無';			// Name of session
var organization = '台灣海洋環境教育推廣協會';			// 參與單位
var date = getTodayString();			// 日期
var attendance = 1;			// 參與人數
var gameYear           = 1;			// Current game year/turn
var maxFishDeep        = 3000;		// Maximum fish in deep sea
var maxFishCoast       = 1500;		//                 coast areas
var initFishDeep       = 2500;		// Initial fish in deep sea
var initFishCoast      = 1200;		//                 coast areas
var opCostDeep         = 250;		// Operating cost in deep sea
var opCostCoast        = 150;		//                   coast areas
var opCostHarbor       = 50;		//                   harbor
var newShipPrice       = 300;		// Price of new ships

// var fishSalesPrice     = 20;		// Price of deep fish
var fishDeepSalesPrice = 20;		// Price of coast fish
var fishCoastSalesPrice= 20;		// Price of fish

var initShipsPerTeam   = 6;			// Initial ships per team
var initBankBalPerTeam = 1200;  	// Initial bank balance per team
var salValDelay        = 2;			// Delay for calculating salvage value
var salValBase         = 250;		// Base value for calculating salvage value
var salvageValue	   = salValBase;// Most recently calculated salvage value
var fishPopDeep;          			// Fish population in deep sea
var fishPopCoast;     				//                    coast areas
var regenerationDeep;               // Fish regeneration in deep sea
var regenerationCoastal;			//                      coastal areas
var totalCatchDeep     = 0;			// Total fish caught in deep sea
var totalCatchCoast    = 0;			//                      coastal areas
var opFleetDeep        = 0;			// Operating fleet in deep sea
var opFleetCoast       = 0;			//                    coastal areas
var opFleetHarbor      = 0;			//                    harbor
var fishDensityDeep;				// Fish density in deep sea
var fishDensityCoastal;				//                 coastal areas

var resumeFlag = false;				// Set to true when resuming a game

var reportType = 9; 				// Used to determine which reports will be displayed
									//    -1 	all reports
									//     0	operator report only
									// 1 - 8    specified team report only
									//     9    all team reports

var keyError = "None";				// Indicator of key error

// Team-specific global arrays have one element for each team
// Note: Since the original program was written in BASIC, where arrays are 1-based
//       by default, the first item (at index 0) in these arrays is ignored
var auctionShips = new Array();			// Ship auction
var auctionDols = new Array();			// Ship auction $
var shipPurch = new Array();			// Ship purchase
var shipPurchDols = new Array();		// Ship purchase $
var shipSales = new Array();			// Ship sales
var shipSalesDols = new Array();		// Ship sales $
var shipOrders = new Array();			// Ship orders
// var shipsAvail = new Array();			// Ships available
var shipsToDeep = new Array();			// Ships sent to deep sea
var shipsToCoast = new Array();			// Ships sent to coastal areas
var shipsToHarbor = new Array();		// Ships remaining in harbor
var catchDeep = new Array();			// Catch in deep sea
var catchCoast = new Array();			// Catch in coastal areas

// Deprecated // Fish price
// var fishPrice = new Array();
// 使用近遠海分開 為陣列，表示各隊魚價可不同
var fishDeepPrice = new Array();	// 遠洋魚價
var fishCoastPrice = new Array();	// 近海魚價

var fishSales = new Array();			// Fish sales
var interest = new Array();				// Interest on bank balance
var bankBal = new Array();				// Bank balance
var ships = new Array();				// Ships operating

var givenDols          = new Array();
var receiveDols        = new Array();
var receiveDolsFromFishery=new Array();

// Global arrays
// Note: Since the original program was written in BASIC, where arrays are 1-based
//       by default, the first item (at index 0) in these arrays is ignored unless
//       specifically noted.

// New Fish
var regeneration = new Array(0,    0,1,2,4,7,10,11,9.5,5.5,3,0);

// Ship Efficiency Multipliers
var productivity_1 = new Array(0,  0,5,10,15,20,25,25,25,25,25,25);
var productivity_2 = new Array(0,  0,3,6,9,12,15,15,15,15,15,15);

// X-axis values
var z = new Array(0,               0,0,0.1,0,0.2,0,0.3,0,0.4,0,0.5,
                                   0,0.6,0,0.7,0,0.8,0,0.9,0,1,0);

// Weather - reproducible "random" sequence, repeats after 20 turns if necessary
// Note: This array was originally 0-based, so the 0-indexed element is used
var weather = new Array(1.00, 1.03, 0.87, 1.14, 1.05, 0.94, 0.90, 1.02, 1.08, 0.89, 1.08,
                              1.10, 1.01, 1.13, 1.06, 1.19, 1.16, 1.10, 1.01, 1.07, 1.11);

// 魚價變化計算公式
var fishSalesPriceFunction = 0; // 預設不變
// Fish Price - set here as a function of time, could also be converted to a function
//              of harvest
// Note: This array was originally 0-based, so the 0-indexed element is used
// Deprecated
// var price = new Array(20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20);
// Deprecated // 遠洋魚價
// var priceDeep = new Array(20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20);
// Deprecated // 近海魚價
// var priceCoast = new Array(20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20);

var continuousForYear = 1; // 連續進行幾年
var fisheryFund = 2000; //漁會資金

var revokeShips = new Array();;//報廢船隻數
var revokeShipDols = 50;//報廢船隻處理費
var revokeShipFishDeep = 5;//報廢船隻減少魚群數量 遠洋
var revokeShipFishCoast = 10;//報廢船隻減少魚群數量 近海

function setTeams(t) {
	if (isNaN(t)) {t = parseInt(t)};	// record a numeric value

	if (t < 1 || t > 8) {
		alert("Attempt to set invalid number of teams (" + t + ") ignored.");
	} else {
		teams = t;
	}
}

function setGivenDols(t, b){
  if (isNaN(b)) {b = parseInt(b)};
  givenDols[t] = b;
}
function setReceiveDols(t, b){
  if (isNaN(b)) {b = parseInt(b)};
  receiveDols[t] = b;
}
function setReceiveDolsFromFishery(t, b){
  if (isNaN(b)) {b = parseInt(b)};
  receiveDolsFromFishery[t] = b;
}

function getRevokeShips(){
  return revokeShips[t];
}
function setRevokeShips(t,b){
  if (isNaN(b)) {b = parseInt(b)};
  revokeShips[t] = b;
}

function getRevokeShipDols(){
  return revokeShipDols;
}
function setRevokeShipDols(s){
  revokeShipDols = s;
}

function getRevokeShipFishDeep(){
  return revokeShipFishDeep;
}
function setRevokeShipFishDeep(s){
  return revokeShipFishDeep = s;
}
function getRevokeShipFishCoast(){
  return revokeShipFishCoast;
}
function setRevokeShipFishCoast(s){
  return revokeShipFishCoast = s;
}

function getTeams() {
	return teams;
}

function getFisheryfund() {
  return fisheryFund;
}

function setFisheryfund(s) {
  fisheryFund = s;
}

function subFisheryfund(s) {
  fisheryFund -= s;
}

function addFisheryfund(s) {
  fisheryFund += s;
}

function setSession(s) {
	session = s;
}

function getSession() {
	return session;
}

function getDate() {
	return date;
}

function setDate(s) {
	date = s;
}

function getTodayString() {
  var today = new Date();
  var day = today.getDate();
  var month = today.getMonth() + 1;
  var year = today.getFullYear();

  if (month < 10) month = "0" + month;
  if (day < 10) day = "0" + day;

	return year + "-" + month + "-" + day;
}

function getAttendance() {
	return attendance;
}

function setAttendance(s) {
	attendance = s;
}

function getOrganization() {
	return organization;
}

function setOrganization(s) {
	organization = s;
}

function resetContinuousForYear() {
	continuousForYear = 1;
}

function setContinuousForYear(y) {
	if (isNaN(y)) {y = parseInt(y)};	// record a numeric value
	continuousForYear = y;
}

function getContinuousForYear() {
	return continuousForYear;
}

function resetGameYear() {
	gameYear = 1;
}

function setGameYear(y) {
	if (isNaN(y)) {y = parseInt(y)};	// record a numeric value
	gameYear = y;
}

function getGameYear() {
	return gameYear;
}

function resetGameYear() {
	gameYear = 1;
}

function advanceGameYear() {
	gameYear++;
}

function recedeGameYear() {
	gameYear--;
}

function setShipsAvail(t,s) {
	if (isNaN(s)) {s = parseInt(s)};	// record a numeric value
	ships[t] = s;
}

function getShipsAvail(t) {
	return ships[t];
}

function setBankBal(t,b) {
	if (isNaN(b)) {b = parseInt(b)};	// record a numeric value
	bankBal[t] = b;
}

function getBankBal(t) {
	return bankBal[t];
}

function setMaxFishDeep(m) {
	if (isNaN(m)) {m = parseInt(m)};	// record a numeric value
	maxFishDeep = m;
}

function getMaxFishDeep() {
	return maxFishDeep;
}

function setMaxFishCoast(m) {
	if (isNaN(m)) {m = parseInt(m)};	// record a numeric value
	maxFishCoast = m;
}

function getMaxFishCoast() {
	return maxFishCoast;
}

function resetInitFish() {
	initFishDeep = 2500;
	initFishCoast = 1200;
}

function setInitFishDeep(i) {
	if (isNaN(i)) {i = parseInt(i)};	// record a numeric value
	initFishDeep = i;
}

function getInitFishDeep() {
	return initFishDeep;
}

function setInitFishCoast(i) {
	if (isNaN(i)) {i = parseInt(i)};	// record a numeric value
	initFishCoast = i;
}

function getInitFishCoast() {
	return initFishCoast;
}

function setOpCostDeep(o) {
	if (isNaN(o)) {o = parseInt(o)};	// record a numeric value
	opCostDeep = o;
}

function getOpCostDeep() {
	return opCostDeep;
}

function setOpCostCoast(o) {
	if (isNaN(o)) {o = parseInt(o)};	// record a numeric value
	opCostCoast = o;
}

function getOpCostCoast() {
	return opCostCoast;
}

function setOpCostHarbor(o) {
	if (isNaN(o)) {o = parseInt(o)};	// record a numeric value
	opCostHarbor = o;
}

function getOpCostHarbor() {
	return opCostHarbor;
}

// Deprecated
function setFishSalesPrice(n) {
	if (isNaN(n)) {n = parseInt(n)};	// record a numeric value
	fishSalesPrice = n;
}

// Deprecated
function getFishSalesPrice() {
	return fishSalesPrice;
}

function setFishDeepSalesPrice(n) {
	if (isNaN(n)) {n = parseInt(n)};	// record a numeric value
	fishDeepSalesPrice = n;
}

function getFishDeepSalesPrice() {
	return fishDeepSalesPrice;
}

function setFishCoastSalesPrice(n) {
	if (isNaN(n)) {n = parseInt(n)};	// record a numeric value
	fishCoastSalesPrice = n;
}

function getFishCoastSalesPrice() {
	return fishCoastSalesPrice;
}

function setNewShipPrice(n) {
	if (isNaN(n)) {n = parseInt(n)};	// record a numeric value
	newShipPrice = n;
}

function getNewShipPrice() {
	return newShipPrice;
}

function setSalValDelay(s) {
	if (isNaN(s)) {s = parseFloat(s)};	// record a numeric value
	salValDelay = s;
}

function getSalValDelay() {
	return salValDelay;
}

function setSalValBase(s) {
	if (isNaN(s)) {s = parseFloat(s)};	// record a numeric value
	salValBase = s;
}

function getSalValBase() {
	return salValBase;
}

function getInitShipsPerTeam() {
	return initShipsPerTeam;
}

function setFishSalesPriceFunction(f) {
  fishSalesPriceFunction = f;
}

function getFishSalesPriceFunction() {
  return fishSalesPriceFunction;
}

function calcInitShipsPerTeam(numOfTeams) {
	switch (numOfTeams) {
		case 1:
			initShipsPerTeam = 24;
			break;
		case 2:
			initShipsPerTeam = 12;
			break;
		case 3:
			initShipsPerTeam = 8;
			break;
		case 4:
			initShipsPerTeam = 6;
			break;
		case 5:
			initShipsPerTeam = 5;
			break;
		case 6:
			initShipsPerTeam = 4;
			break;
    case 7:
			initShipsPerTeam = 3;
		  break;
    case 8:
			initShipsPerTeam = 3;
			break;
		default:
			alert("Invalid number of teams passed to calcInitShipsPerTeam: " + numOfTeams);
			initShipsPerTeam = 0;
			break;
	}

	return initShipsPerTeam;
}

function calcInitBankBalPerTeam() {
	initBankBalPerTeam = initShipsPerTeam * 200;

	return initBankBalPerTeam;
}

// This function was converted directly from the original
// Fishbanks code
function table(x, zarray) {
	var l, y, nn;

	// table function subroutine
	l = (zarray.length - 1)/2
	if (x <= zarray[1]) {y = zarray[2];}

	if (x > zarray[2*l-1]) {y = zarray[2*l];}

	for (nn = 3; nn <= 2*l-1; nn += 2) {
		if (x <= zarray[nn]) {
			// interpolate
			y = zarray[nn-1] + (zarray[nn+1]-zarray[nn-1])*(x-zarray[nn-2])/(zarray[nn]-zarray[nn-2])
			break;
		}
	}

	return y;
}

// This function begins the game. It is called when the user is ready to leave the
// setup page. In the original code it was called create_0.
function initializeGame() {
	// Local scratch variables
	var x = 0;
	var t = 0;
	var i = 0;

	// Initialize globals for a new game
	totalCatchDeep, totalCatchCoast = 0;
	opFleetDeep = 0;
	opFleetCoast = 0;
	opFleetHarbor = 0;
	for (t = 1; t<=teams; t++) {
		auctionShips[t] = 0;
		auctionDols[t] = 0;
		shipPurch[t] = 0;
		shipPurchDols[t] = 0;
		shipSales[t] = 0;
		shipSalesDols[t] = 0;
		shipOrders[t] = 0;
		shipsToDeep[t] = initShipsPerTeam - 1;
		shipsToCoast[t] = initShipsPerTeam - shipsToDeep[t];

		// Prior team state
		catchDeep[t] = shipsToDeep[t] * 25;
		catchCoast[t] = shipsToCoast[t] * 15;

    fishDeepPrice[t] = fishDeepSalesPrice;
    fishCoastPrice[t] = fishCoastSalesPrice;
    fishSales[t] = catchDeep[t]*fishDeepPrice[t] + catchCoast[t]*fishCoastPrice[t];

		interest[t] = Math.floor(0.05 * (initBankBalPerTeam - fishSales[t]/2)/10 + 0.5) * 10;
		// if (!resumeFlag) {
		// 	setBankBal(t, initBankBalPerTeam);
		// 	setShipsAvail(t, initShipsPerTeam);
		// }

		totalCatchDeep += catchDeep[t];			// Total harvest    Deep sea
		totalCatchCoast += catchCoast[t];		//                  Coastal areas
		opFleetDeep += shipsToDeep[t];			// Total ships      Deep sea
		opFleetCoast += shipsToCoast[t];		//                  Coastal areas
		opFleetHarbor += ships[t] - shipsToDeep[t] - shipsToCoast[t];  // Harbor

    givenDols[t] = 0;
    receiveDols[t] = 0;
    receiveDolsFromFishery[t] = 0;
    revokeShips[t] = 0;
	}

	// Fish population
	if (!resumeFlag) {
		fishPopDeep = initFishDeep;
		fishPopCoast = initFishCoast;
	}

	x = fishPopDeep/maxFishDeep;
	for (i = 1; i <= 11; i++) {
		z[2 * i] =  regeneration[i];
	}
	regenerationDeep = Math.floor(50 * table(x, z));

	x = fishPopCoast/maxFishCoast;
	for (i = 1; i <= 11; i++) {
		z[2 * i] =  regeneration[i];
	}
	regenerationCoast = Math.floor(30 * table(x, z));

	// Fish density
	fishDensityDeep = Math.round(fishPopDeep/maxFishDeep * 100)/100;
	fishDensityCoast = Math.round(fishPopCoast/maxFishCoast * 100)/100;

  resetAllData();
}

// 計算新魚價
function calcFishSalesPrices() {
  /*
  fishDeepSalesPrice = 20;
  fishCoastSalesPrice= 20;
  */
}

// This function performs the calculations to advance the game through the next turn.
// It is called when the user is ready to accept the teams' decisions as entered into
// the decisions window. In the original code it was called calculate.
function executeTurn() {
	// Local scratch variables
	var x = 0;
	var t = 0;
	var i = 0;
	var qDeep, qCoast;
	var expenseDeep, expenseCoast, expenseHarbor;
	var orderMoney, minBankBal, interestEarned;

	// Initialize counts of total ships in each area
	opFleetDeep = 0;
	opFleetCoast = 0;
	opFleetHarbor = 0;

	// Process teams individually
	for (t = 1; t<=teams; t++) {

		// Determine fleets and bank balances after trades and orders
		setBankBal(t, bankBal[t] - auctionDols[t] - shipPurchDols[t] + shipSalesDols[t]);
    // 拍賣會的錢給漁會
    addFisheryfund(auctionDols[t]);

		// Determine total ships in fishing areas
		opFleetDeep += shipsToDeep[t];
		opFleetCoast += shipsToCoast[t];
		opFleetHarbor += ships[t] - shipsToDeep[t] - shipsToCoast[t];
	}

	// Ship efficiency multiplier for deep sea
	x = fishPopDeep/maxFishDeep;
	for (i = 1; i <= 11; i++) {
		z[2*i] = productivity_1[i];
	}
	qDeep = table(x, z);

	// Ship efficiency multiplier for coastal areas
	x = fishPopCoast/maxFishCoast;
	for (i = 1; i <= 11; i++) {
		z[2*i] = productivity_2[i];
	}
	qCoast = table(x, z);

	// Total harvest
	// Note: The modulo 20 operations in the indices allow the sequences to repeat
	//       if more than 20 turns are played
	totalCatchDeep = opFleetDeep * qDeep * weather[gameYear % 20];
	totalCatchCoast = opFleetCoast * qCoast * weather[gameYear % 20];

	// Adjust if harvest exceeds fish population
	if (totalCatchDeep > fishPopDeep) {
		qDeep *= fishPopDeep/totalCatchDeep;
	}
	if (totalCatchCoast > fishPopCoast) {
		qCoast *= fishPopCoast/totalCatchCoast;
	}

  // 先檢查漁會資金是不是小於零了，避免利息發到一半，有人有，有人沒有
  var isFisheryFundLessThanZero = fisheryFund <= 0;
	// Process teams individually
	for (t = 1; t<=teams; t++) {

		// Catch
		catchDeep[t] = Math.floor(shipsToDeep[t] * qDeep * weather[gameYear % 20] + 0.5);
		catchCoast[t] = Math.floor(shipsToCoast[t] * qCoast * weather[gameYear % 20] + 0.5);

		// Price
    fishDeepPrice[t] = fishDeepSalesPrice;
    fishCoastPrice[t] = fishCoastSalesPrice;

		// Income from harvest sales
		fishSales[t] = catchDeep[t]*fishDeepPrice[t] + catchCoast[t]*fishCoastPrice[t];

		// Operating expenses and order costs
		expenseDeep = opCostDeep * shipsToDeep[t];
		expenseCoast = opCostCoast * shipsToCoast[t];
		expenseHarbor = opCostHarbor * (ships[t] - shipsToDeep[t] - shipsToCoast[t]);
		orderMoney = newShipPrice * shipOrders[t];
    // 買船跟船隻操作費用的錢給漁會
    addFisheryfund(orderMoney);
    addFisheryfund(expenseDeep);
		addFisheryfund(expenseCoast);
		addFisheryfund(expenseHarbor);

		// Bank balance
		minBankBal = bankBal[t] - expenseDeep - expenseCoast - expenseHarbor;
		if (minBankBal < 0) {
			interestEarned = Math.floor((0.15 * minBankBal + 5)/10) * 10;
		} else if (isFisheryFundLessThanZero){
			interestEarned = 0;
		} else {
      interestEarned = Math.floor((0.1 * minBankBal + 5)/10) * 10;
    }
		interest[t] = interestEarned;
		bankBal[t] = minBankBal + fishSales[t] + interestEarned - orderMoney;

    // 報廢船隻
    if(revokeShips[t]) {
      setShipsAvail(t, ships[t] - revokeShips[t]);
      bankBal[t] -= revokeShips[t] * revokeShipDols;
      // 費用給漁會
      addFisheryfund(revokeShips[t] * revokeShipDols);
    }

    // 利息從漁會來
    subFisheryfund(interest[t]);

		// Ship fleet
		setShipsAvail(t, ships[t] + shipOrders[t]);		// One year construction delay
	}

	// Fish populations after harvest
	totalCatchDeep = 0;
	totalCatchCoast = 0;
	for (t = 1; t<=teams; t++) {
		totalCatchDeep += catchDeep[t];
		totalCatchCoast += catchCoast[t];
	}
	fishPopDeep = Math.max(0, fishPopDeep - totalCatchDeep);
	fishPopCoast = Math.max(0, fishPopCoast - totalCatchCoast);

  // 報廢造成的魚量增減
  fishPopDeep -= revokeShipFishDeep;//報廢船隻減少魚群數量 遠洋
  fishPopCoast -= revokeShipFishCoast;//報廢船隻減少魚群數量 近海
  if (fishPopDeep<0) fishPopDeep=0;
  if (fishPopCoast<0) fishPopCoast=0;

	// New fish
	x = fishPopDeep/maxFishDeep;
	for (i = 1; i <= 11; i++) {
		z[2*i] = regeneration[i];
	}
	regenerationDeep = Math.floor(50 * table(x, z));
	x = fishPopCoast/maxFishCoast;
	for (i = 1; i <= 11; i++) {
		z[2*i] = regeneration[i];
	}
	regenerationCoast = Math.floor(30 * table(x, z));

	// Fish populations
	fishPopDeep += regenerationDeep;
	fishPopCoast += regenerationCoast;

	// Fish density
	fishDensityDeep = Math.round(fishPopDeep/maxFishDeep*100)/100;
	fishDensityCoast = Math.round(fishPopCoast/maxFishCoast*100)/100;
}

var tableBackgroundColor = [
    null,
    "rgba(255,192,203,0.5)",
    "rgba(190,190,190,0.5)",
    "rgba(255,165,0,0.5)",
    "rgba(255,0,0,0.5)",
    "rgba(255,255,0,0.5)",
    "rgba(0,0,255,0.5)",
    "rgba(165,42,42,0.5)",
    "rgba(0,255,0,0.5)",
  ];
function generateTeamRowReport(team) {
	var report = "<tr style='background-color: " + tableBackgroundColor[team] + "' align='center'><td><big>" + team + "</big></td>";
	report += "<td><big>" + catchDeep[team] + "</big></td>";
	report += "<td><big>" + catchCoast[team] + "</big></td>";
	report += "<td><big>" + fishDeepPrice[team] + "</big></td>";
	report += "<td><big>" + fishCoastPrice[team] + "</big></td>";
	report += "<td><big>" + fishSales[team] + "</big></td>";
	if (gameYear == 1) {
		report += "      <td><big>0</big></td>";
	} else {
		report += "      <td><big>" + interest[team] + "</big></td>";
	}
	report += "<td><big>" + bankBal[team] + "</big></td>";
	report += "<td><big>" + ships[team] + "</big></td></tr>";
	return report;
}
function generateTeamColumnReport() {
	var report = "<table border='1'><tr align='center'><td align='center'><big>組別</big></td>";
    for (var t = 1; t <= teams; t++)
    	report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + t + "</big></td>";
    if (gameYear>1) {
    report += "</tr><tr><td><big>R1 遠洋漁獲</big></td>";
    for (var t = 1; t <= teams; t++)
    	report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + catchDeep[t] + "</big></td>";
    report += "</tr>";
      report += "</tr><tr><td><big>R2 近海漁獲</big></td>";
    for (var t = 1; t <= teams; t++)
    	report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + catchCoast[t] + "</big></td>";
    report += "</tr>";
    report += "</tr><tr><td><big>R3.1 遠洋魚價</big></td>";
    for (var t = 1; t <= teams; t++)
    	report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + fishDeepPrice[t] + "</big></td>";
    report += "</tr>";
    report += "</tr><tr><td><big>R3.2 近海魚價</big></td>";
    for (var t = 1; t <= teams; t++)
    	report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + fishCoastPrice[t] + "</big></td>";
    report += "</tr>";
    report += "</tr><tr><td><big>R4 售魚總收入</big></td>";
    for (var t = 1; t <= teams; t++)
    	report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + fishSales[t] + "</big></td>";
    report += "</tr><tr><td><big>R5 利息</big></td>";
    if (gameYear == 1) {
      for (var t = 1; t <= teams; t++)
  		  report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + 0 + "</big></td>";
  	} else {
      for (var t = 1; t <= teams; t++)
  		  report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + interest[t] + "</big></td>";
  	}
    report += "</tr>";
  }
  report += "<tr><td><big>R6 銀行結餘</big></td>";
  for (var t = 1; t <= teams; t++)
    report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + bankBal[t] + "</big></td>";
  report += "</tr><tr><td><big>R7 船隊總船數</big></td>";
  for (var t = 1; t <= teams; t++)
    report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + ships[t] + "</big></td>";
  report += "</tr><tr><td><big>R8 總資產</big></td>";
  for (var t = 1; t <= teams; t++)
    report += "<td align='center' style='background-color: " + tableBackgroundColor[t] + "'><big>" + getTeamAssets(t) + "</big></td>";
  report += "</tr></table>";
	return report;
}
// This function generates the team report for the specified team and
// returns the report as a string value
function generateTeamReport(team) {
	var report;

	// Header
	report =  '<div class="teamreport">\n';
	report += '  <div class="reporthead">\n';
	report += '    <span class="title">組別 ' + team + '</span>\n';
	// report += '    <div><span class="yearlabel">Year:</span>';
	// report += '    <span class="yearvalue">' + gameYear + '</span></div>\n';
	report += '  </div>\n';

	// Team data
	report += '  <table class="reporttable">\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:1</td>\n';
	report += '      <td class="label">遠洋漁獲</td>\n';
	report += '      <td class="value">' + catchDeep[team] + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:2</td>\n';
	report += '      <td class="label">近海漁獲</td>\n';
	report += '      <td class="value">' + catchCoast[team] + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:3.1</td>\n';
	report += '      <td class="label">遠洋魚價</td>\n';
	report += '      <td class="value">' + fishDeepPrice[team] + '</td>\n';
	report += '    </tr>\n';
  report += '    <tr>\n';
  report += '      <td class="code">R:3.2</td>\n';
  report += '      <td class="label">近海魚價</td>\n';
  report += '      <td class="value">' + fishCoastPrice[team] + '</td>\n';
  report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:4</td>\n';
	report += '      <td class="label">售魚總收入</td>\n';
	report += '      <td class="value">' + fishSales[team] + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:5</td>\n';
	report += '      <td class="label">利息</td>\n';
	if (gameYear == 1) {
		report += '      <td class="value">0</td>\n';
	} else {
		report += '      <td class="value">' + interest[team] + '</td>\n';
	}
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:6</td>\n';
	report += '      <td class="label">銀行結餘</td>\n';
	report += '      <td class="value">' + bankBal[team] + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="code">R:7</td>\n';
	report += '      <td class="label">船隊總船數</td>\n';
	report += '      <td class="value">' + ships[team] + '</td>\n';
	report += '    </tr>\n';
	report += '  </table>\n';
	report += '</div>\n';

	return report;
}

function getFishPopDeep() {
	return fishPopDeep;
}

function getFishPopCoast() {
	return fishPopCoast;
}

function setFishPopDeep(t) {
	fishPopDeep =t;
}

function setFishPopCoast(t) {
	fishPopCoast =t;
}

function getShipIndex() {
  return (Math.floor(20 * (opFleetDeep + opFleetCoast + opFleetHarbor)/(teams * initShipsPerTeam)))/10;
}

function getCatchIndex() {
  return (Math.floor(20 * (totalCatchDeep + totalCatchCoast)/600))/10;
}

function getFishIndex() {
  return (Math.floor(100 * (fishPopDeep + fishPopCoast)/(maxFishDeep + maxFishCoast)))/10;
}

function getTeamAssets(t) {
  return Math.round(bankBal[t] + (ships[t] * salvageValue));
}

// This function generates the operator's report and returns the report
// as a string value

// 改為全域
function generateOperatorReport() {
	var report;
	var totalBankBal = 0;
	var totalShips = 0;
	var teamAssets = 0;
	var totalAssets = 0;
	var y = gameYear;
	var shipIndex;
	var catchIndex;
	var fishIndex;

	// Header
	report =  '<div class="operreport">\n';
	report += '  <div class="reporthead">\n';
	report += '    <span class="title">操作報表</span>\n';
	// report += '    <span class="sessionlabel">Session name:</span>';
	// report += '    <span class="sessionvalue">' + session + '</span>\n';
	// report += '    <div><span class="yearlabel">Year:</span>';
	// report += '    <span class="yearvalue">' + gameYear + '</span></div>\n';
	report += '  </div>\n';

	// Overview data
	report += '  <table class="reporttable">\n';
	report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">作業船數</td>\n';
	report += '      <td class="label2">遠洋</td>\n';
	report += '      <td class="value">' + opFleetDeep + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label2">近海</td>\n';
	report += '      <td class="value">' + opFleetCoast + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">單船平均捕獲量</td>\n';
	report += '      <td class="label2">遠洋</td>\n';
	// AMG 2/11/08 Modified following to return a constant value of 25 for year 1
	var catchPerShipDeep = (y == 1?25:(opFleetDeep > 0?totalCatchDeep/opFleetDeep:0)) + "    ";
	// var catchPerShipDeep = (opFleetDeep > 0?totalCatchDeep/opFleetDeep:0) + "    ";
  // catchPerShipDeep = catchPerShipDeep.substr(1,4);
	catchPerShipDeep = Math.floor(catchPerShipDeep*10)/10;
	report += '      <td class="value">' + catchPerShipDeep + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label2">近海</td>\n';
	var catchPerShipCoast = (opFleetCoast > 0?totalCatchCoast/opFleetCoast:0) + "    ";
	// catchPerShipCoast = catchPerShipCoast.substr(1,4);
	catchPerShipCoast = Math.floor(catchPerShipCoast*10)/10;
	report += '      <td class="value">' + catchPerShipCoast + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1">天氣參數</td>\n';
	report += '      <td class="label2">&nbsp;</td>\n';
	report += '      <td class="value">' + weather[(y-1) % 20] + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">總捕獲量</td>\n';
	report += '      <td class="label2">遠洋</td>\n';
	report += '      <td class="value">' + totalCatchDeep + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label2">近海</td>\n';
	report += '      <td class="value">' + totalCatchCoast + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">新魚數量</td>\n';
	report += '      <td class="label2">遠洋</td>\n';
	report += '      <td class="value">' + regenerationDeep + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label2">近海</td>\n';
	report += '      <td class="value">' + regenerationCoast + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">魚族群量</td>\n';
	report += '      <td class="label2">遠洋</td>\n';
	report += '      <td class="value">' + fishPopDeep + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label2">近海</td>\n';
	report += '      <td class="value">' + fishPopCoast + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">魚群密度</td>\n';
	report += '      <td class="label2">遠洋</td>\n';
	report += '      <td class="value">' + fishDensityDeep + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label2">近海</td>\n';
	report += '      <td class="value">' + fishDensityCoast + '</td>\n';
	report += '    </tr>\n';
	report += '    <tr>\n';
	report += '      <td class="label1">漁船淨殘值</td>\n';
	report += '      <td class="label2">&nbsp;</td>\n';
	report += '      <td class="value">' + salvageValue + '</td>\n';
	report += '    </tr>\n';

  report += '    <tr>\n';
	report += '      <td class="label1" rowspan="2">漁會資金</td>\n';
	report += '      <td class="label2">&nbsp;</td>\n';
	report += '      <td class="value">' + fisheryFund + '</td>\n';
	report += '    </tr>\n';

	report += '  </table>\n';

	// Team rankings
	report +=  '<div class="rankingreport">\n';
	report += '  <div class="reporthead">\n';
	report += '    <span class="title">總資產</span>\n';
	report += '    <div><span class="yearlabel">Year:</span>';
	report += '    <span class="yearvalue">' + y + '</span></div>\n';
	report += '  </div>\n';

	report += '  <table class="reporttable">\n';
	report += '    <tr>\n';
	report += '      <th class="col1">組別</th>\n';
	report += '      <th class="col2">船數</th>\n';
	report += '      <th class="col3">銀行結餘</th>\n';
	report += '      <th class="col4">總資產</th>\n';
	report += '    </tr>\n';

	for (var t = 1; t <= teams; t++) {
		totalBankBal += bankBal[t];
		totalShips += ships[t];
		teamAssets = getTeamAssets(t);
		totalAssets += teamAssets;
		report += '    <tr>\n';
		report += '      <td class="col1">' + t + '</td>\n';
		report += '      <td class="col2">' + ships[t] + '</td>\n';
		report += '      <td class="col3">' + bankBal[t] + '</td>\n';
		report += '      <td class="col4">' + teamAssets + '</td>\n';
		report += '    </tr>\n';
	}

	report += '    <tr class="total">\n';
	report += '      <th class="col1">合計</th>\n';
	report += '      <td class="col2">' + totalShips + '</td>\n';
	report += '      <td class="col3">' + totalBankBal + '</td>\n';
	report += '      <td class="col4">' + totalAssets + '</td>\n';
	report += '    </tr>\n';
	report += '  </table>\n';

	// Worksheet indices
	shipIndex = getShipIndex();
	catchIndex = getCatchIndex();
	fishIndex = getFishIndex();
	report += '  <div class="reporthead">\n';
	report += '    <span class="title">指數表</span>\n';
	report += '    <span class="shipindexlabel">船指數:</span>';
	report += '    <span class="shipindexvalue">' + shipIndex + '</span><br />\n';
	report += '    <span class="catchindexlabel">捕獲指數:</span>';
	report += '    <span class="catchindexvalue">' + catchIndex + '</span><br />\n';
	report += '    <span class="fishindexlabel">魚群指數:</span>';
	report += '    <span class="fishindexvalue">' + fishIndex + '</span>\n';
	report += '  </div>\n';

	report += '</div>\n';

	return report;
}

// Calculate the salvage value for a given year. Use variable salvage value
// process.
// Calculate the salvage value for a given year. Use variable salvage value
// process.
function calcSalvageValue(yr) {
	// Local variables
	var harborCost;
	var deepSeaProfit;
	var coastalProfit;
	var totalProfit;
	var totalShips;
	var averageProfit;
	var salvageVal = salvageValue;

	if (yr == 1) {
		// Initialize the base value for the first year's salvage value at 250
		salvageVal = salValBase;
	} else {
		harborCost = opCostHarbor * opFleetHarbor;

		if (opFleetDeep == 0) {
			deepSeaProfit = 0;
		} else {
			deepSeaProfit = (fishDeepPrice[1] * (totalCatchDeep/opFleetDeep) - opCostDeep) * opFleetDeep;
		}

		if (opFleetCoast == 0) {
			coastalProfit = 0;
		} else {
			// Note: We just use the price for team #1 here. Right now, all
			//       teams get the same price. If this fact changes, however,
			//       we'll need to change the next line to use an average
			//       price across all teams.
			coastalProfit = (fishCoastPrice[1] * (totalCatchCoast/opFleetCoast) - opCostCoast) * opFleetCoast;
		}

		totalProfit = deepSeaProfit + coastalProfit - harborCost;

		totalShips = opFleetDeep + opFleetCoast + opFleetHarbor;

		averageProfit = totalProfit/totalShips;

		salvageVal = Math.floor(salvageVal + ((averageProfit - salvageVal)/salValDelay));
	}

	if (salvageVal < 0) { salvageVal = 0; }

	return salvageVal;
}

// Calculate the salvage value for a given year. Use variable salvage value
// process.
function original_calcSalvageValue(yr) {
	// Local variables
	var harborCost;
	var deepSeaProfit;
	var coastalProfit;
	var totalProfit;
	var totalShips;
	var averageProfit;

	// Initialize the base value for the first year's salvage value at 250
	var salvageVal = 250;

	// Calculate subsequent years' values off this basis
	for (var y = 2; y <= yr; y++) {
		harborCost = opCostHarbor * opFleetHarbor;

		if (opFleetDeep == 0) {
			deepSeaProfit = 0;
		} else {
			// Note: We just use the price for team #1 here. Right now, all
			//       teams get the same price. If this fact changes, however,
			//       we'll need to change the next line to use an average
			//       price across all teams.
			deepSeaProfit = (fishDeepPrice[1] * (totalCatchDeep/opFleetDeep) - opCostDeep) * opFleetDeep;
		}

		if (opFleetCoast == 0) {
			coastalProfit = 0;
		} else {
			// Note: We just use the price for team #1 here. Right now, all
			//       teams get the same price. If this fact changes, however,
			//       we'll need to change the next line to use an average
			//       price across all teams.
			coastalProfit = (fishCoastPrice[1] * (totalCatchCoast/opFleetCoast) - opCostCoast) * opFleetCoast;
		}

		totalProfit = deepSeaProfit + coastalProfit - harborCost;

		totalShips = opFleetDeep + opFleetCoast + opFleetHarbor;

		averageProfit = totalProfit/totalShips;

		salvageVal = Math.floor(salvageVal + ((averageProfit - salvageVal)/salValDelay));
	}

	if (salvageVal < 0) { salvageVal = 0; }

	return salvageVal;
}

// Pad txt to a length of padTo by adding spaces to the left
function padLeft(txt, padTo) {
	var i;
	var result = txt;

	for (i = 0; i < padTo - txt.length; i++) {
		result = " " + result;
	}

	return result;
}

function validateKey(key) {
	var i;
	var testsum;
	var teststr;
	var testArr = new Array(3,5,4,7);
	var testexp = /^(\w\w[BRQT]\w)-(\w[AJL]\w\w)-(\w\w\w[3679])-([DGKPX]\w\w\w)$/;
	key = key.toUpperCase();
	var result = key.match(testexp);

	if (result != null) {
		testsum = 0;
		teststr = result[1];
		for (i = 0; i < teststr.length; i++) {
			testsum += teststr.charCodeAt(i);
		}
		if (testsum % testArr[0] == 0) {
			testsum = 0;
			teststr = result[2];
			for (i = 0; i < teststr.length; i++) {
				testsum += teststr.charCodeAt(i);
			}
			if (testsum % testArr[1] == 0) {
				testsum = 0;
				teststr = result[3];
				for (i = 0; i < teststr.length; i++) {
					testsum += teststr.charCodeAt(i);
				}
				if (testsum % testArr[2] == 0) {
					testsum = 0;
					teststr = result[4];
					for (i = 0; i < teststr.length; i++) {
						testsum += teststr.charCodeAt(i);
					}
					if (testsum % testArr[3] == 0) {
						return true;
					}
				}
			}
		}
	}
	return false;
}

// Example:
// writeCookie("myCookie", "my name", 31);
// Stores the string "my name" in the cookie "myCookie" which expires after 31 days.
function writeCookie(name, value, days)
{
  var expire = "";
  if (days != null)
  {
    expire = new Date((new Date()).getTime() + days * 86400000);
    expire = "; expires=" + expire.toGMTString();
  }
  document.cookie = name + "=" + escape(value) + expire;
}

// Example:
// alert( readCookie("myCookie") );
function readCookie(name)
{
  var cookieValue = "";
  var search = name + "=";
  if(document.cookie.length > 0)
  {
    offset = document.cookie.indexOf(search);
    if (offset != -1)
    {
      offset += search.length;
      end = document.cookie.indexOf(";", offset);
      if (end == -1) end = document.cookie.length;
      cookieValue = unescape(document.cookie.substring(offset, end))
    }
  }
  return cookieValue;
}

function resetAllData() {
	myStorage.setItem("csv", JSON.stringify({team : [null], operator : [null], index : [null], }));
  myStorage.setItem("allData", JSON.stringify(new Array()));
  myStorage.setItem("salvageValues", JSON.stringify(new Array()));
  myStorage.setItem("shipIndices", JSON.stringify(new Array()));
	myStorage.setItem("catchIndices", JSON.stringify(new Array()));
	myStorage.setItem("fishIndices", JSON.stringify(new Array()));

  var teamBankBalData = new Array();
  var teamAssetsData = new Array();
  var teamShipsData = new Array();
  var teamCatchDeepData = new Array();
  var teamCatchCoastData = new Array();
  var teamFishDeepPriceData = new Array();
  var teamFishCoastPriceData = new Array();
  var teamFishSalesData = new Array();
  var teamInterestData = new Array();
  teamBankBalData.push(null);
  teamAssetsData.push(null);
  teamShipsData.push(null);
  teamCatchDeepData.push(null);
  teamCatchCoastData.push(null);
  teamFishDeepPriceData.push(null);
  teamFishCoastPriceData.push(null);
  teamFishSalesData.push(null);
  teamInterestData.push(null);
  for(var t=0; t<teams; t++){
    teamBankBalData.push(new Array());
    teamAssetsData.push(new Array());
    teamShipsData.push(new Array());
    teamCatchDeepData.push(new Array());
    teamCatchCoastData.push(new Array());
    teamFishDeepPriceData.push(new Array());
    teamFishCoastPriceData.push(new Array());
    teamFishSalesData.push(new Array());
    teamInterestData.push(new Array());
  }

  // start 組別資料，需製成CSV
  myStorage.setItem("teamCatchDeepData", JSON.stringify(teamCatchDeepData));
  myStorage.setItem("teamCatchCoastData", JSON.stringify(teamCatchCoastData));
  myStorage.setItem("teamFishDeepPriceData", JSON.stringify(teamFishDeepPriceData));
  myStorage.setItem("teamFishCoastPriceData", JSON.stringify(teamFishCoastPriceData));
  myStorage.setItem("teamFishSalesData", JSON.stringify(teamFishSalesData));
  myStorage.setItem("teamInterestData", JSON.stringify(teamInterestData));
  myStorage.setItem("teamBankBalData", JSON.stringify(teamBankBalData));
  myStorage.setItem("teamShipsData", JSON.stringify(teamAssetsData));
  // end 組別資料，需製成CSV

  // start 操作者資料，需製成CSV
  myStorage.setItem("operatorOpFleetDeepData", JSON.stringify(new Array()));
  myStorage.setItem("operatorOpFleetCoastData", JSON.stringify(new Array()));
  myStorage.setItem("operatorCatchPerShipDeepData", JSON.stringify(new Array()));
  myStorage.setItem("operatorCatchPerShipCoastData", JSON.stringify(new Array()));
  myStorage.setItem("operatorWeatherData", JSON.stringify(new Array()));
  myStorage.setItem("operatorTotalCatchDeepData", JSON.stringify(new Array()));
  myStorage.setItem("operatorTotalCatchCoastData", JSON.stringify(new Array()));
  myStorage.setItem("operatorRegenerationDeepData", JSON.stringify(new Array()));
  myStorage.setItem("operatorRegenerationCoastData", JSON.stringify(new Array()));
  myStorage.setItem("operatorFishPopDeepData", JSON.stringify(new Array()));
  myStorage.setItem("operatorFishPopCoastData", JSON.stringify(new Array()));
  myStorage.setItem("operatorFishDensityDeepData", JSON.stringify(new Array()));
  myStorage.setItem("operatorFishDensityCoastData", JSON.stringify(new Array()));
  myStorage.setItem("operatorSalvageValueData", JSON.stringify(new Array()));
  myStorage.setItem("operatorFisheryFundData", JSON.stringify(new Array()));
  // end 操作者資料，需製成CSV

  // start 各隊決策資料(返回上一年顯示用)
  myStorage.setItem("AuctionShipsData", JSON.stringify([null]));
  myStorage.setItem("AuctionDolsData", JSON.stringify([null]));
  myStorage.setItem("ShipPurchData", JSON.stringify([null]));
  myStorage.setItem("ShipPurchDolsData", JSON.stringify([null]));
  myStorage.setItem("ShipSalesData", JSON.stringify([null]));
  myStorage.setItem("ShipSalesDolsData", JSON.stringify([null]));
  myStorage.setItem("ShipOrdersData", JSON.stringify([null]));
  myStorage.setItem("ShipsToDeepData", JSON.stringify([null]));
  myStorage.setItem("ShipsToCoastData", JSON.stringify([null]));
  myStorage.setItem("GivenDolsData", JSON.stringify([null]));
  myStorage.setItem("ReceiveDolsData", JSON.stringify([null]));
  myStorage.setItem("ReceiveDolsFromFisheryData", JSON.stringify([null]));
  myStorage.setItem("RevokeShipsData", JSON.stringify([null]));
  myStorage.setItem("FishDeepSalesPriceData", JSON.stringify([null]));
  myStorage.setItem("FishCoastSalesPriceData", JSON.stringify([null]));
  myStorage.setItem("FishPopDeepData", JSON.stringify([null]));
  myStorage.setItem("FishPopCoastData", JSON.stringify([null]));
  myStorage.setItem("RevokeShipDolsData", JSON.stringify([null]));
  myStorage.setItem("ContinuousForYearData", JSON.stringify([null]));
  // end 各隊決策資料(返回上一年顯示用)

  myStorage.setItem("teamAssetsData", JSON.stringify(teamAssetsData));


  myStorage.setItem("fishPopDeepData", JSON.stringify(new Array()));
  myStorage.setItem("fishPopCoastData", JSON.stringify(new Array()));
  myStorage.setItem("fishDensityDeepData", JSON.stringify(new Array()));
  myStorage.setItem("fishDensityCoastData", JSON.stringify(new Array()));
}

// Save the current game state. Must be called BEFORE calculating
// salvage value for current year!
function saveGame() {
  // 資本資料
  var data  = {
    session : getSession(),
    teams : getTeams(),
    bankBal : bankBal,
    ships : ships,
    salvageValue : salvageValue,
    fishPopDeep : fishPopDeep,
    fishPopCoast : fishPopCoast,
    regenerationDeep : regenerationDeep,
    regenerationCoast : regenerationCoast,
    initShipsPerTeam : initShipsPerTeam,
    shipsToDeep : shipsToDeep,
    shipsToCoast : shipsToCoast,
    interest : interest,
    gameYear : gameYear, // 以上原生就有

    // 以下是新增的資料
    // 包含原本不可修改的，變成可修改的
    organization : organization,
    date : date,
    attendance : attendance,
    maxFishDeep : maxFishDeep,
    maxFishCoast : maxFishCoast,
    fishDeepSalesPrice : fishDeepSalesPrice,
    fishCoastSalesPrice : fishCoastSalesPrice
  };
  var allData = JSON.parse(myStorage.getItem("allData"));
  allData[gameYear] = data;
  myStorage.setItem("allData", JSON.stringify(allData));

  // 儲存salvageValue
  var salvageValues = JSON.parse(myStorage.getItem("salvageValues"));
  salvageValues[gameYear] = salvageValue;
  myStorage.setItem("salvageValues", JSON.stringify(salvageValues));

  // 儲存indicex
  var shipIndices = JSON.parse(myStorage.getItem("shipIndices"));
  shipIndices[gameYear] = getShipIndex();
  myStorage.setItem("shipIndices", JSON.stringify(shipIndices));

  var catchIndices = JSON.parse(myStorage.getItem("catchIndices"));
  catchIndices[gameYear] = getCatchIndex();
  myStorage.setItem("catchIndices", JSON.stringify(catchIndices));

  var fishIndices = JSON.parse(myStorage.getItem("fishIndices"));
  fishIndices[gameYear] =getFishIndex();
  myStorage.setItem("fishIndices", JSON.stringify(fishIndices));

  // 儲存每個玩家的資產資料
  // 二維陣列 例如：[null, [玩家1 year1 bankBal, ...], [玩家2 year1 bankBal, ...], ...]
  var teamCatchDeepData = JSON.parse(myStorage.getItem("teamCatchDeepData"));
  var teamCatchCoastData = JSON.parse(myStorage.getItem("teamCatchCoastData"));
  var teamFishDeepPriceData = JSON.parse(myStorage.getItem("teamFishDeepPriceData"));
  var teamFishCoastPriceData = JSON.parse(myStorage.getItem("teamFishCoastPriceData"));
  var teamFishSalesData = JSON.parse(myStorage.getItem("teamFishSalesData"));
  var teamInterestData = JSON.parse(myStorage.getItem("teamInterestData"));

  var teamBankBalData = JSON.parse(myStorage.getItem("teamBankBalData"));
  var teamShipsData = JSON.parse(myStorage.getItem("teamShipsData"));
  var teamAssetsData = JSON.parse(myStorage.getItem("teamAssetsData"));
  for (t = 1; t<=teams; t++) {
    teamBankBalData[t][gameYear] = bankBal[t];
    teamShipsData[t][gameYear] = ships[t];
    teamAssetsData[t][gameYear] = getTeamAssets(t);

    teamCatchDeepData[t][gameYear] = catchDeep[t];
    teamCatchCoastData[t][gameYear] = catchCoast[t];
    teamFishDeepPriceData[t][gameYear] = fishDeepPrice[t];
    teamFishCoastPriceData[t][gameYear] = fishCoastPrice[t];
    teamFishSalesData[t][gameYear] = fishSales[t];
    if(gameYear==1)
      teamInterestData[t][gameYear] = 0;
    else
      teamInterestData[t][gameYear] = interest[t];
  }
  myStorage.setItem("teamBankBalData", JSON.stringify(teamBankBalData));
  myStorage.setItem("teamShipsData", JSON.stringify(teamShipsData));
  myStorage.setItem("teamAssetsData", JSON.stringify(teamAssetsData));
  myStorage.setItem("teamCatchDeepData", JSON.stringify(teamCatchDeepData));
  myStorage.setItem("teamCatchCoastData", JSON.stringify(teamCatchCoastData));
  myStorage.setItem("teamFishDeepPriceData", JSON.stringify(teamFishDeepPriceData));
  myStorage.setItem("teamFishCoastPriceData", JSON.stringify(teamFishCoastPriceData));
  myStorage.setItem("teamFishSalesData", JSON.stringify(teamFishSalesData));
  myStorage.setItem("teamInterestData", JSON.stringify(teamInterestData));

  // 儲存魚量資料
  var fishPopDeepData = JSON.parse(myStorage.getItem("fishPopDeepData"));
  fishPopDeepData[gameYear] = fishPopDeep;
  myStorage.setItem("fishPopDeepData", JSON.stringify(fishPopDeepData));

  var fishPopCoastData = JSON.parse(myStorage.getItem("fishPopCoastData"));
  fishPopCoastData[gameYear] = fishPopCoast;
  myStorage.setItem("fishPopCoastData", JSON.stringify(fishPopCoastData));

  var fishDensityDeepData = JSON.parse(myStorage.getItem("fishDensityDeepData"));
  fishDensityDeepData[gameYear] = fishDensityDeep;
  myStorage.setItem("fishDensityDeepData", JSON.stringify(fishDensityDeepData));

  var fishDensityCoastData = JSON.parse(myStorage.getItem("fishDensityCoastData"));
  fishDensityCoastData[gameYear] = fishDensityCoast;
  myStorage.setItem("fishDensityCoastData", JSON.stringify(fishDensityCoastData));

  // 儲存操作者資料
  var catchPerShipDeep = (gameYear == 1?25:(opFleetDeep > 0?totalCatchDeep/opFleetDeep:0)) + "    ";
	catchPerShipDeep = Math.floor(catchPerShipDeep*10)/10;
  var catchPerShipCoast = (opFleetCoast > 0?totalCatchCoast/opFleetCoast:0) + "    ";
	catchPerShipCoast = Math.floor(catchPerShipCoast*10)/10;

  var operatorOpFleetDeepData = JSON.parse(myStorage.getItem("operatorOpFleetDeepData"));
  operatorOpFleetDeepData[gameYear] = opFleetDeep;
  myStorage.setItem("operatorOpFleetDeepData", JSON.stringify(operatorOpFleetDeepData));
  var operatorOpFleetCoastData = JSON.parse(myStorage.getItem("operatorOpFleetCoastData"));
  operatorOpFleetCoastData[gameYear] = opFleetCoast;
  myStorage.setItem("operatorOpFleetCoastData", JSON.stringify(operatorOpFleetCoastData));
  var operatorCatchPerShipDeepData = JSON.parse(myStorage.getItem("operatorCatchPerShipDeepData"));
  operatorCatchPerShipDeepData[gameYear] = catchPerShipDeep;
  myStorage.setItem("operatorCatchPerShipDeepData", JSON.stringify(operatorCatchPerShipDeepData));
  var operatorCatchPerShipCoastData = JSON.parse(myStorage.getItem("operatorCatchPerShipCoastData"));
  operatorCatchPerShipCoastData[gameYear] = catchPerShipCoast;
  myStorage.setItem("operatorCatchPerShipCoastData", JSON.stringify(operatorCatchPerShipCoastData));
  var operatorWeatherData = JSON.parse(myStorage.getItem("operatorWeatherData"));
  operatorWeatherData[gameYear] = weather[(gameYear-1) % 20];
  myStorage.setItem("operatorWeatherData", JSON.stringify(operatorWeatherData));
  var operatorTotalCatchDeepData = JSON.parse(myStorage.getItem("operatorTotalCatchDeepData"));
  operatorTotalCatchDeepData[gameYear] = totalCatchDeep;
  myStorage.setItem("operatorTotalCatchDeepData", JSON.stringify(operatorTotalCatchDeepData));
  var operatorTotalCatchCoastData = JSON.parse(myStorage.getItem("operatorTotalCatchCoastData"));
  operatorTotalCatchCoastData[gameYear] = totalCatchCoast;
  myStorage.setItem("operatorTotalCatchCoastData", JSON.stringify(operatorTotalCatchCoastData));
  var operatorRegenerationDeepData = JSON.parse(myStorage.getItem("operatorRegenerationDeepData"));
  operatorRegenerationDeepData[gameYear] = regenerationDeep;
  myStorage.setItem("operatorRegenerationDeepData", JSON.stringify(operatorRegenerationDeepData));
  var operatorRegenerationCoastData = JSON.parse(myStorage.getItem("operatorRegenerationCoastData"));
  operatorRegenerationCoastData[gameYear] = regenerationCoast;
  myStorage.setItem("operatorRegenerationCoastData", JSON.stringify(operatorRegenerationCoastData));
  var operatorFishPopDeepData = JSON.parse(myStorage.getItem("operatorFishPopDeepData"));
  operatorFishPopDeepData[gameYear] = fishPopDeep;
  myStorage.setItem("operatorFishPopDeepData", JSON.stringify(operatorFishPopDeepData));
  var operatorFishPopCoastData = JSON.parse(myStorage.getItem("operatorFishPopCoastData"));
  operatorFishPopCoastData[gameYear] = fishPopCoast;
  myStorage.setItem("operatorFishPopCoastData", JSON.stringify(operatorFishPopCoastData));
  var operatorFishDensityDeepData = JSON.parse(myStorage.getItem("operatorFishDensityDeepData"));
  operatorFishDensityDeepData[gameYear] = fishDensityDeep;
  myStorage.setItem("operatorFishDensityDeepData", JSON.stringify(operatorFishDensityDeepData));
  var operatorFishDensityCoastData = JSON.parse(myStorage.getItem("operatorFishDensityCoastData"));
  operatorFishDensityCoastData[gameYear] = fishDensityCoast;
  myStorage.setItem("operatorFishDensityCoastData", JSON.stringify(operatorFishDensityCoastData));
  var operatorSalvageValueData = JSON.parse(myStorage.getItem("operatorSalvageValueData"));
  operatorSalvageValueData[gameYear] = salvageValue;
  myStorage.setItem("operatorSalvageValueData", JSON.stringify(operatorSalvageValueData));
  var operatorFisheryFundData = JSON.parse(myStorage.getItem("operatorFisheryFundData"));
  operatorFisheryFundData[gameYear] = fisheryFund;
  myStorage.setItem("operatorFisheryFundData", JSON.stringify(operatorFisheryFundData));

  // 儲存各隊決策(返回上一年顯示用)
  var AuctionShipsData = JSON.parse(myStorage.getItem("AuctionShipsData"));
  AuctionShipsData[gameYear-1] = auctionShips;
  myStorage.setItem("AuctionShipsData", JSON.stringify(AuctionShipsData));
  var AuctionDolsData = JSON.parse(myStorage.getItem("AuctionDolsData"));
  AuctionDolsData[gameYear-1] = auctionDols;
  myStorage.setItem("AuctionDolsData", JSON.stringify(AuctionDolsData));
  var ShipPurchData = JSON.parse(myStorage.getItem("ShipPurchData"));
  ShipPurchData[gameYear-1] = shipPurch;
  myStorage.setItem("ShipPurchData", JSON.stringify(ShipPurchData));
  var ShipPurchDolsData = JSON.parse(myStorage.getItem("ShipPurchDolsData"));
  ShipPurchDolsData[gameYear-1] = shipPurchDols;
  myStorage.setItem("ShipPurchDolsData", JSON.stringify(ShipPurchDolsData));
  var ShipSalesData = JSON.parse(myStorage.getItem("ShipSalesData"));
  ShipSalesData[gameYear-1] = shipSales;
  myStorage.setItem("ShipSalesData", JSON.stringify(ShipSalesData));
  var ShipSalesDolsData = JSON.parse(myStorage.getItem("ShipSalesDolsData"));
  ShipSalesDolsData[gameYear-1] = shipSalesDols;
  myStorage.setItem("ShipSalesDolsData", JSON.stringify(ShipSalesDolsData));
  var ShipOrdersData = JSON.parse(myStorage.getItem("ShipOrdersData"));
  ShipOrdersData[gameYear-1] = shipOrders;
  myStorage.setItem("ShipOrdersData", JSON.stringify(ShipOrdersData));
  var ShipsToDeepData = JSON.parse(myStorage.getItem("ShipsToDeepData"));
  ShipsToDeepData[gameYear-1] = shipsToDeep;
  myStorage.setItem("ShipsToDeepData", JSON.stringify(ShipsToDeepData));
  var ShipsToCoastData = JSON.parse(myStorage.getItem("ShipsToCoastData"));
  ShipsToCoastData[gameYear-1] = shipsToCoast;
  myStorage.setItem("ShipsToCoastData", JSON.stringify(ShipsToCoastData));
  var GivenDolsData = JSON.parse(myStorage.getItem("GivenDolsData"));
  GivenDolsData[gameYear-1] = givenDols;
  myStorage.setItem("GivenDolsData", JSON.stringify(GivenDolsData));
  var ReceiveDolsData = JSON.parse(myStorage.getItem("ReceiveDolsData"));
  ReceiveDolsData[gameYear-1] = receiveDols;
  myStorage.setItem("ReceiveDolsData", JSON.stringify(ReceiveDolsData));
  var ReceiveDolsFromFisheryData = JSON.parse(myStorage.getItem("ReceiveDolsFromFisheryData"));
  ReceiveDolsFromFisheryData[gameYear-1] = receiveDolsFromFishery;
  myStorage.setItem("ReceiveDolsFromFisheryData", JSON.stringify(ReceiveDolsFromFisheryData));
  var RevokeShipsData = JSON.parse(myStorage.getItem("RevokeShipsData"));
  RevokeShipsData[gameYear-1] = revokeShips;
  myStorage.setItem("RevokeShipsData", JSON.stringify(RevokeShipsData));
  var FishDeepSalesPriceData = JSON.parse(myStorage.getItem("FishDeepSalesPriceData"));
  FishDeepSalesPriceData[gameYear-1] = fishDeepSalesPrice;
  myStorage.setItem("FishDeepSalesPriceData", JSON.stringify(FishDeepSalesPriceData));
  var FishCoastSalesPriceData = JSON.parse(myStorage.getItem("FishCoastSalesPriceData"));
  FishCoastSalesPriceData[gameYear-1] = fishCoastSalesPrice;
  myStorage.setItem("FishCoastSalesPriceData", JSON.stringify(FishCoastSalesPriceData));
  var FishPopDeepData = JSON.parse(myStorage.getItem("FishPopDeepData"));
  FishPopDeepData[gameYear-1] =  fishPopDeep;
  myStorage.setItem("FishPopDeepData", JSON.stringify(FishPopDeepData));
  var FishPopCoastData = JSON.parse(myStorage.getItem("FishPopCoastData"));
  FishPopCoastData[gameYear-1] = fishPopCoast;
  myStorage.setItem("FishPopCoastData", JSON.stringify(FishPopCoastData));
  var RevokeShipDolsData = JSON.parse(myStorage.getItem("RevokeShipDolsData"));
  RevokeShipDolsData[gameYear-1] = revokeShipDols;
  myStorage.setItem("RevokeShipDolsData", JSON.stringify(RevokeShipDolsData));
  var ContinuousForYearData = JSON.parse(myStorage.getItem("ContinuousForYearData"));
  ContinuousForYearData[gameYear-1] = continuousForYear;
  myStorage.setItem("ContinuousForYearData", JSON.stringify(ContinuousForYearData));

 //  // 儲存CSV {team : [null], operator : [null], index : [null], }
 //  var csv = JSON.parse(myStorage.getItem("csv"));

 //  myStorage.setItem("csv", JSON.stringify(csv));
	//   function generateTeamRowReport(team) {
	// 	var report = "<tr style='background-color: " + tableBackgroundColor[team] + "' align='center'><td><big>" + team + "</big></td>";
	// 	report += "<td><big>" + catchDeep[team] + "</big></td>";
	// 	report += "<td><big>" + catchCoast[team] + "</big></td>";
	// 	report += "<td><big>" + fishDeepPrice[team] + "</big></td>";
	// 	report += "<td><big>" + fishCoastPrice[team] + "</big></td>";
	// 	report += "<td><big>" + fishSales[team] + "</big></td>";
	// 	if (gameYear == 1) {
	// 		report += '      <td><big>0</big></td>';
	// 	} else {
	// 		report += '      <td><big>' + interest[team] + '</big></td>';
	// 	}
	// 	report += "<td><big>" + bankBal[team] + "</big></td>";
	// 	report += "<td><big>" + ships[team] + "</big></td></tr>";
	// 	return report;
	// }
}

function generateCSVReportInfo() {
  var csv = "參與單位," + getOrganization() + "\n";
  csv += "日期," + getTodayString() + "\n";
  csv += "參與人數," + getAttendance() + "\n";
  csv += "備註," + getSession() + "\n";
  return csv;
}

function generateTeamCSVReport() {
  var teamCatchDeepData = JSON.parse(myStorage.getItem("teamCatchDeepData"));
  var teamCatchCoastData = JSON.parse(myStorage.getItem("teamCatchCoastData"));
  var teamFishDeepPriceData = JSON.parse(myStorage.getItem("teamFishDeepPriceData"));
  var teamFishCoastPriceData = JSON.parse(myStorage.getItem("teamFishCoastPriceData"));
  var teamFishSalesData = JSON.parse(myStorage.getItem("teamFishSalesData"));
  var teamInterestData = JSON.parse(myStorage.getItem("teamInterestData"));
  var teamBankBalData = JSON.parse(myStorage.getItem("teamBankBalData"));
  var teamShipsData = JSON.parse(myStorage.getItem("teamShipsData"));

  var teamAssetsData = JSON.parse(myStorage.getItem("teamAssetsData"));

  // teamCatchDeepData.pop();
  // teamCatchCoastData.pop();
  // teamFishDeepPriceData.pop();
  // teamFishCoastPriceData.pop();
  // teamFishSalesData.pop();
  // teamInterestData.pop();
  // teamBankBalData.pop();
  // teamShipsData.pop();

  var csvReport = "各組別報表\n年,";
  for(y = 1; y<=gameYear; y++){
    csvReport += y+",";
    for (t = 1; t<teams; t++)
      csvReport += ",";
  }
  csvReport += "\n";
  csvReport += "組別,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += t+",";
  csvReport += "\n";
  // console.log(teamCatchDeepData.join(','));
  csvReport += "R:1 遠洋漁獲,"
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamCatchDeepData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:2 近海漁獲,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamCatchCoastData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:3.1 遠洋魚價,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamFishDeepPriceData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:3.2 近海魚價,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamFishCoastPriceData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:4 售魚總收入,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamFishSalesData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:5 利息,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamInterestData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:6 銀行結餘,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamBankBalData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:7 船隊總船數,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamShipsData[t][y]+",";;
  csvReport += "\n";

  csvReport += "R:8 總資產,";
  for(y = 1; y<=gameYear; y++)
    for (t = 1; t<=teams; t++)
      csvReport += teamAssetsData[t][y]+",";;
  csvReport += "\n";

  // csvReport += "R:1 遠洋漁獲" + teamCatchDeepData.join(',') + '\n';
  // csvReport += "R:2 近海漁獲" + teamCatchCoastData.join(',') + '\n';
  // csvReport += "R:3.1 遠洋魚價" + teamFishDeepPriceData.join(',') + '\n';
  // csvReport += "R:3.2 近海魚價" + teamFishCoastPriceData.join(',') + '\n';
  // csvReport += "R:4 售魚總收入" + teamFishSalesData.join(',') + '\n';
  // csvReport += "R:5 利息" + teamInterestData.join(',') + '\n';
  // csvReport += "R:6 銀行結餘" + teamBankBalData.join(',') + '\n';
  // csvReport += "R:7 船隊總船數" + teamShipsData.join(',') + '\n';
  // csvReport += "\n";

  return csvReport;
}

function generateOperatorCSVReport() {
  var operatorOpFleetDeepData = JSON.parse(myStorage.getItem("operatorOpFleetDeepData"));
  var operatorOpFleetCoastData = JSON.parse(myStorage.getItem("operatorOpFleetCoastData"));
  var operatorCatchPerShipDeepData = JSON.parse(myStorage.getItem("operatorCatchPerShipDeepData"));
  var operatorCatchPerShipCoastData = JSON.parse(myStorage.getItem("operatorCatchPerShipCoastData"));
  var operatorWeatherData = JSON.parse(myStorage.getItem("operatorWeatherData"));
  var operatorTotalCatchDeepData = JSON.parse(myStorage.getItem("operatorTotalCatchDeepData"));
  var operatorTotalCatchCoastData = JSON.parse(myStorage.getItem("operatorTotalCatchCoastData"));
  var operatorRegenerationDeepData = JSON.parse(myStorage.getItem("operatorRegenerationDeepData"));
  var operatorRegenerationCoastData = JSON.parse(myStorage.getItem("operatorRegenerationCoastData"));
  var operatorFishPopDeepData = JSON.parse(myStorage.getItem("operatorFishPopDeepData"));
  var operatorFishPopCoastData = JSON.parse(myStorage.getItem("operatorFishPopCoastData"));
  var operatorFishDensityDeepData = JSON.parse(myStorage.getItem("operatorFishDensityDeepData"));
  var operatorFishDensityCoastData = JSON.parse(myStorage.getItem("operatorFishDensityCoastData"));
  var operatorSalvageValueData = JSON.parse(myStorage.getItem("operatorSalvageValueData"));
  var operatorFisheryFundData = JSON.parse(myStorage.getItem("operatorFisheryFundData"));

  var shipIndices = JSON.parse(myStorage.getItem("shipIndices"));
  var catchIndices = JSON.parse(myStorage.getItem("catchIndices"));
  var fishIndices = JSON.parse(myStorage.getItem("fishIndices"));

  var csvReport = "操作報表\n年,";
  for(y=1; y<=gameYear; y++)
    csvReport += y+",";
  csvReport += "\n";


  csvReport += "作業船數 遠洋" + operatorOpFleetDeepData.join(',') + '\n';
  csvReport += "作業船數 近海" + operatorOpFleetCoastData.join(',') + '\n';
  csvReport += "單船平均捕獲量 遠洋" + operatorCatchPerShipDeepData.join(',') + '\n';
  csvReport += "單船平均捕獲量 近海" + operatorCatchPerShipCoastData.join(',') + '\n';
  csvReport += "天氣參數" + operatorWeatherData.join(',') + '\n';
  csvReport += "總捕獲量 遠洋" + operatorTotalCatchDeepData.join(',') + '\n';
  csvReport += "總捕獲量 近海" + operatorTotalCatchCoastData.join(',') + '\n';
  csvReport += "新魚數量 遠洋" + operatorRegenerationDeepData.join(',') + '\n';
  csvReport += "新魚數量 近海" + operatorRegenerationCoastData.join(',') + '\n';
  csvReport += "魚族群量 遠洋" + operatorFishPopDeepData.join(',') + '\n';
  csvReport += "魚族群量 近海" + operatorFishPopCoastData.join(',') + '\n';
  csvReport += "魚群密度 遠洋" + operatorFishDensityDeepData.join(',') + '\n';
  csvReport += "魚群密度 近海" + operatorFishDensityCoastData.join(',') + '\n';
  csvReport += "漁船淨殘值" + operatorSalvageValueData.join(',') + '\n';
  csvReport += "漁會資金" + operatorFisheryFundData.join(',') + '\n';

  csvReport += "船指數" + shipIndices.join(',') + '\n';
  csvReport += "捕獲指數" + catchIndices.join(',') + '\n';
  csvReport += "魚群指數" + fishIndices.join(',') + '\n';


  return csvReport;
}

function resumeGameToYear(year, the_form) {
	var qDeep, qCoast;
	var expenseDeep, expenseCoast, expenseHarbor;
	var orderMoney, minBankBal, interestEarned;
	var i;
	var gameDataJSON = myStorage.getItem("allData");

	if (gameDataJSON == "") {
		alert('Sorry, there are no data\nsaved on this browser.');
    return false;
	}// else {
		// var msg = 'Restore game data for session ' + data[0] + '\nat year ' + data[yrIndex] + '?';
		// if (confirm(msg)) {
  var allData = JSON.parse(gameDataJSON);
  if(year<0) year = (allData.length)-1; // 回到最近的一年
  var data = allData[year];

  var sessionName = data["session"];
  if(typeof(the_form) !== 'undefined') {
    the_form.SessionFld.value = sessionName;
  }
	setSession(sessionName);

  var teams = data["teams"];
  if(typeof(the_form) !== 'undefined') {
    the_form.TeamsSel.selectedIndex = teams - 1;
  }
	setTeams(teams);

  bankBal = data["bankBal"];
  ships = data["ships"];
  shipsToDeep = data["shipsToDeep"];
  shipsToCoast = data["shipsToCoast"];
  interest = data["interest"];

  salvageValue = data["salvageValue"];
	setSalValBase(salvageValue);    // ***
	fishPopDeep = data["fishPopDeep"];
	setInitFishDeep(fishPopDeep);  // ***
	fishPopCoast = data["fishPopCoast"];
	setInitFishCoast(fishPopCoast); // ***
	setGameYear(data["gameYear"]-1);
	regenerationDeep = data["regenerationDeep"];
	regenerationCoast = data["regenerationCoast"];
	initShipsPerTeam = data["initShipsPerTeam"];

  opFleetDeep = 0;
	opFleetCoast = 0;
	opFleetHarbor = 0;
  for (t = 1; t<=teams; t++) {
		// Determine total ships in fishing areas
		opFleetDeep += shipsToDeep[t];
		opFleetCoast += shipsToCoast[t];
		opFleetHarbor += ships[t] - shipsToDeep[t] - shipsToCoast[t];
	}

  // Ship efficiency multiplier for deep sea
	x = fishPopDeep/maxFishDeep;
	for (i = 1; i <= 11; i++) {
		z[2*i] = productivity_1[i];
	}
	qDeep = table(x, z);

	// Ship efficiency multiplier for coastal areas
	x = fishPopCoast/maxFishCoast;
	for (i = 1; i <= 11; i++) {
		z[2*i] = productivity_2[i];
	}
	qCoast = table(x, z);

	// Total harvest
	// Note: The modulo 20 operations in the indices allow the sequences to repeat
	//       if more than 20 turns are played
	totalCatchDeep = opFleetDeep * qDeep * weather[gameYear % 20];
	totalCatchCoast = opFleetCoast * qCoast * weather[gameYear % 20];

	// Adjust if harvest exceeds fish population
	if (totalCatchDeep > fishPopDeep) {
		qDeep *= fishPopDeep/totalCatchDeep;
	}
	if (totalCatchCoast > fishPopCoast) {
		qCoast *= fishPopCoast/totalCatchCoast;
	}

	for (t = 1; t<=teams; t++) {
		auctionShips[t] = 0;
		auctionDols[t] = 0;
		shipPurch[t] = 0;
		shipPurchDols[t] = 0;
		shipSales[t] = 0;
		shipSalesDols[t] = 0;
		shipOrders[t] = 0;

		catchDeep[t] = Math.floor(shipsToDeep[t] * qDeep * weather[gameYear % 20] + 0.5);
		catchCoast[t] = Math.floor(shipsToCoast[t] * qCoast * weather[gameYear % 20] + 0.5);
    fishDeepPrice[t] = fishDeepSalesPrice;
    fishCoastPrice[t] = fishCoastSalesPrice;
		fishSales[t] = catchDeep[t]*fishDeepPrice[t] + catchCoast[t]*fishCoastPrice[t];
	}

  // 新增或改成可以自訂的變數
  organization = data["organization"];
  date = data["date"];
  attendance = data["attendance"];
  maxFishDeep = data["maxFishDeep"];
  maxFishCoast = data["maxFishCoast"];
  fishDeepSalesPrice = data["fishDeepSalesPrice"];
  fishCoastSalesPrice = data["fishCoastSalesPrice"];

	// Fish density
	fishDensityDeep = Math.round(fishPopDeep/maxFishDeep * 100)/100;
	fishDensityCoast = Math.round(fishPopCoast/maxFishCoast * 100)/100;

  // start 各隊決策資料(返回上一年顯示用)
  var auctionShipsData = JSON.parse(myStorage.getItem("AuctionShipsData"));
  auctionShips = auctionShipsData[year];
  var auctionDolsData = JSON.parse(myStorage.getItem("AuctionDolsData"));
  auctionDols = auctionDolsData[year];
  var shipPurchData = JSON.parse(myStorage.getItem("ShipPurchData"));
  shipPurch = shipPurchData[year];
  var shipPurchDolsData = JSON.parse(myStorage.getItem("ShipPurchDolsData"));
  shipPurchDols = shipPurchDolsData[year];
  var shipSalesData = JSON.parse(myStorage.getItem("ShipSalesData"));
  shipSales = shipSalesData[year];
  var shipSalesDolsData = JSON.parse(myStorage.getItem("ShipSalesDolsData"));
  shipSalesDols = shipSalesDolsData[year];
  var shipOrdersData = JSON.parse(myStorage.getItem("ShipOrdersData"));
  shipOrders = shipOrdersData[year];
  var shipsToDeepData = JSON.parse(myStorage.getItem("ShipsToDeepData"));
  shipsToDeep = shipsToDeepData[year];
  var shipsToCoastData = JSON.parse(myStorage.getItem("ShipsToCoastData"));
  shipsToCoast = shipsToCoastData[year];

  var givenDolsData = JSON.parse(myStorage.getItem("GivenDolsData"));
  givenDols = givenDolsData[year];
  var receiveDolsData = JSON.parse(myStorage.getItem("ReceiveDolsData"));
  receiveDols = receiveDolsData[year];
  var receiveDolsFromFisheryData = JSON.parse(myStorage.getItem("ReceiveDolsFromFisheryData"));
  receiveDolsFromFishery = receiveDolsFromFisheryData[year];
  var revokeShipsData = JSON.parse(myStorage.getItem("RevokeShipsData"));
  revokeShips = revokeShipsData[year];

  var fishDeepSalesPriceData = JSON.parse(myStorage.getItem("FishDeepSalesPriceData"));
  fishDeepSalesPrice = fishDeepSalesPriceData[year];
  var fishCoastSalesPriceData = JSON.parse(myStorage.getItem("FishCoastSalesPriceData"));
  fishCoastSalesPrice = fishCoastSalesPriceData[year];
  var fishPopDeepData = JSON.parse(myStorage.getItem("FishPopDeepData"));
  fishPopDeep = fishPopDeepData[year];
  var fishPopCoastData = JSON.parse(myStorage.getItem("FishPopCoastData"));
  fishPopCoast = fishPopCoastData[year];

  var revokeShipDolsData = JSON.parse(myStorage.getItem("RevokeShipDolsData"));
  revokeShipDols = revokeShipDolsData[year];
  var continuousForYearData = JSON.parse(myStorage.getItem("ContinuousForYearData"));
  continuousForYear = continuousForYearData[year];
  // console.log("Year: " + year + ", continuousForYear:" + continuousForYear + ", data: " + continuousForYearData + ", continuousForYearData[year]: " + continuousForYearData[year]);
  // end 各隊決策資料(返回上一年顯示用)

	resumeFlag = true;
	advanceGameYear();

  return true;
	// MainFrame.location.replace('setup.html');
		// }
	// }
}

function resumeGame(the_form) {
  console.log(gameYear);
  if(resumeGameToYear(1, the_form)){
    MainFrame.location.replace('setup.html');
  }
}

function resumePreviousYear() {
	if(resumeGameToYear(gameYear-1)){
    MainFrame.location.replace('decisions.html');
  }
}

// 因為有兩個頁面可以設定，所以改成全域
function validateFishDeepSalesPrice(fld) {
	var entry = parseInt(fld.value);

	if (isNaN(entry) || entry < 1) {
		alert('You mast enter a numeric value more than 1!');
		fld.focus();
		fld.select();
		return false;
	}
	// parent.setFishDeepSalesPrice(entry);
  setFishDeepSalesPrice(entry);
	fld.value = entry;
	return true;
}

function validateFishCoastSalesPrice(fld) {
	var entry = parseInt(fld.value);

	if (isNaN(entry) || entry < 1) {
		alert('You mast enter a numeric value more than 1!');
		fld.focus();
		fld.select();
		return false;
	}
	// parent.setFishCoastSalesPrice(entry);
  setFishCoastSalesPrice(entry);
	fld.value = entry;
	return true;
}
