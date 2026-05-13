// File: decisionlib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the Team Decisions screen of the Fishbanks program.
// It contains the code that is specific to this single screen.
//
// Revision History:
//   8/22/2004   Version 8.0
//     Initial release

// Navigate HTML text input fields with arrow keys
function setupNavInputWithArrowKeys(){
	$('input').keyup(function (e) {
    if (e.which == 39) { // right arrow
      $(this).closest('td').next().find('input').focus();
    } else if (e.which == 37) { // left arrow
      $(this).closest('td').prev().find('input').focus();
    } else if (e.which == 40) { // down arrow
      $(this).closest('tr').next().find('td:eq(' + $(this).closest('td').index() + ')').prev().find('input').focus();
    } else if (e.which == 38) { // up arrow
      $(this).closest('tr').prev().find('td:eq(' + $(this).closest('td').index() + ')').prev().find('input').focus();
    }
  });

  // un-comment to display key code
  // $("input").keydown(function (e) {
  //   alert(e.which);
  // });
}

$(document).on('focus', 'input[type="text"]', function() {
  this.select();
});

// Handle the page load event for decisions.html
function handleLoad() {
	var i;
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();

	updateAuctionShipsTotal();
	updateAuctionDolsTotal();
	updateShipPurchTotal();
	updateShipPurchDolsTotal();
	updateShipSalesTotal();
	updateShipSalesDolsTotal();
	updateShipOrdersTotal();

	updateShipsAvailTotal();
	updateShipsToDeepTotal();
	updateShipsToCoastTotal();

	for (var t = 1; t <= teams; t++) {
		updateShipsToHarbor(t);
	}

	if(parent.resumeFlag){
		for (var t = 1; t <= teams; t++) {
			changeShips(t);
		}
	}

	the_form.AuctionShips1Fld.focus();
	the_form.AuctionShips1Fld.select();

	setupNavInputWithArrowKeys();
}

function changeShips(t) {
	var the_form = document.DecisionsFrm;
	var shipsAvailable;
	var auctionShips;
	var purchShips;
	var salesShips;
	var revokeShips;

	updateAuctionShipsTotal();
	updateShipPurchTotal();
	updateShipSalesTotal();
	updateRevokeShipTotal();

	shipsAvailable = parseInt(parent.getShipsAvail(t));
	auctionShips = parseInt(the_form["AuctionShips" + t + "Fld"].value);
	purchShips = parseInt(the_form["ShipPurch" + t + "Fld"].value);
	salesShips = parseInt(the_form["ShipSales" + t + "Fld"].value);
	revokeShips = parseInt(the_form["RevokeShips" + t + "Fld"].value);
	shipsAvailable += (auctionShips + purchShips - salesShips - revokeShips);
	the_form["ShipsAvail" + t + "Fld"].value = shipsAvailable;
	updateShipsToHarbor(t);

	updateShipsAvailTotal();
}

function updateAuctionShipsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["AuctionShips" + t + "Fld"].value);
	}

	the_form.AuctionShipsTotalFld.value = total;
}

function updateAuctionDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["AuctionDols" + t + "Fld"].value);
	}

	the_form.AuctionDolsTotalFld.value = total;
}

function updateShipPurchTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipPurch" + t + "Fld"].value);
	}

	the_form.ShipPurchTotalFld.value = total;
}

function updateShipPurchDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipPurchDols" + t + "Fld"].value);
	}

	the_form.ShipPurchDolsTotalFld.value = total;
}

function updateShipSalesTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipSales" + t + "Fld"].value);
	}

	the_form.ShipSalesTotalFld.value = total;
}

function updateShipSalesDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipSalesDols" + t + "Fld"].value);
	}

	the_form.ShipSalesDolsTotalFld.value = total;
}

function updateShipOrdersTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipOrders" + t + "Fld"].value);
	}

	the_form.ShipOrdersTotalFld.value = total;
}

function updateShipsAvailTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipsAvail" + t + "Fld"].value);
	}

	the_form.ShipsAvailTotalFld.value = total;
}

function updateShipsToDeepTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipsToDeep" + t + "Fld"].value);
	}

	the_form.ShipsToDeepTotalFld.value = total;
}

function updateShipsToCoastTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipsToCoast" + t + "Fld"].value);
	}

	the_form.ShipsToCoastTotalFld.value = total;
}

function updateShipsToHarborTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ShipsToHarbor" + t + "Fld"].value);
	}

	the_form.ShipsToHarborTotalFld.value = total;
}

function updateGivenDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["GivenDols" + t + "Fld"].value);
	}

	the_form.GivenDolsTotalFld.value = total;
}

function updateReceiveDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ReceiveDols" + t + "Fld"].value);
	}

	the_form.ReceiveDolsTotalFld.value = total;
}

function updateReceiveDolsFromFisheryTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["ReceiveDolsFromFishery" + t + "Fld"].value);
	}

	the_form.ReceiveDolsFromFisheryTotalFld.value = total;
}

function updateRevokeShipTotal(){

	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(the_form["RevokeShips" + t + "Fld"].value);
	}

	the_form.RevokeShipTotalFld.value = total;
}

function updateShipsToHarbor(team) {
	var the_form = document.DecisionsFrm;
	var total = 0;

	total = parseInt(the_form["ShipsAvail" + team + "Fld"].value);
	total -= parseInt(the_form["ShipsToDeep" + team + "Fld"].value);
	total -= parseInt(the_form["ShipsToCoast" + team + "Fld"].value);
	the_form["ShipsToHarbor" + team + "Fld"].value = total;

	updateShipsToHarborTotal();
}

// Ensure that the referenced text field contains a numeric value. If not, generate
// an error dialog and the reset focus to the offending field and select its contents.
// The value is truncated to an integer value.
// If negallow is true, negative values are acceptable.
function validateDec(field,negallow) {
	var entry = parseInt(field.value)
	if (isNaN(entry) || field.value == "") {
		alert('此欄位必須輸入數字');
		field.focus();
		field.select();
		return false;
	} else if (!negallow && entry < 0) {
		alert('此欄位必須輸入非負數');
		field.focus();
		field.select();
		return false;
	} else {
		field.value = entry;
		return true;
	}
}

function validateDecNoneZero(field,negallow) {
	var entry = parseInt(field.value)
	if (isNaN(entry) || field.value == "") {
		alert('此欄位必須輸入數字');
		field.focus();
		field.select();
		return false;
	} else if (entry < 1) {
		// alert('此欄位必須輸入非負數');
		alert('連續進行幾年欄位，數值需大於1');
		field.focus();
		field.select();
		return false;
	} else {
		field.value = entry;
		return true;
	}
}

function validateRevokeShips(field,negallow) {
	var entry = parseInt(field.value)
	if (isNaN(entry) || field.value == "") {
		alert('此欄位必須輸入數字');
		field.focus();
		field.select();
		return false;
	} else if (!negallow && entry < 0) {
		alert('此欄位必須輸入非負數');
		field.focus();
		field.select();
		return false;
	} else {
		field.value = entry;
		return true;
	}
}

// This function picks up the values entered into the fields on the decision screen
// and stores them as numeric variables to simplify the calculations in the
// executeTurn() function. It calls the executeTurn() function when it's done.
// Note that this function assumes that the fields have already been validated as
// containing numeric values of some sort.
function processDecisions() {
	var the_form = document.DecisionsFrm;
	// Local scratch variables
	var t = 0;

	var totalShipPurch = parseInt(the_form.ShipPurchTotalFld.value);
	var totalShipSales = parseInt(the_form.ShipSalesTotalFld.value);
	if (totalShipPurch != totalShipSales) {
		alert('D3 購入總船數合計，必須等於\nD5 售出總船數合計');
		the_form.ShipPurch1Fld.focus();
		the_form.ShipPurch1Fld.select();
		return false;
	}

	var totalShipPurchDols = parseInt(the_form.ShipPurchDolsTotalFld.value);
	var totalShipSalesDols = parseInt(the_form.ShipSalesDolsTotalFld.value);
	if (totalShipPurchDols != totalShipSalesDols) {
		alert('D4 購入總花費合計，必須等於\nD6 售船總收入合計');
		the_form.ShipPurchDols1Fld.focus();
		the_form.ShipPurchDols1Fld.select();
		return false;
	}

	var totalGivenDols = parseInt(the_form.GivenDolsTotalFld.value);
	var totalReceiveDols = parseInt(the_form.ReceiveDolsTotalFld.value);
	if (totalGivenDols != totalReceiveDols) {
		alert('D12 給出去的錢合計，必須等於\nD13 收到的錢合計');
		the_form.GivenDols1Fld.focus();
		the_form.GivenDols1Fld.select();
		return false;
	}

	var teams = parent.getTeams();
	var shipsAvail;
	var shipsOrdered;
	var shipsToHarbor;

	for (var t = 1; t <= teams; t++) {
		shipsAvail = parseInt(the_form["ShipsAvail" + t + "Fld"].value);
		if (shipsAvail < 0) {
			alert('第 ' + t + ' 組的可派船數\n不能小於 0');
			the_form["ShipPurch" + t + "Fld"].focus();
			the_form["ShipPurch" + t + "Fld"].select();
			return false;
		}
		shipsOrdered = parseInt(the_form["ShipOrders" + t + "Fld"].value);
		if (shipsOrdered > Math.round(shipsAvail/2)) {
			alert('每年訂購的新船數，不能超過\n現有船隊的一半');
			the_form["ShipOrders" + t + "Fld"].focus();
			the_form["ShipOrders" + t + "Fld"].select();
			return false;
		}

		shipsToHarbor = parseInt(the_form["ShipsToHarbor" + t + "Fld"].value);
		if (shipsToHarbor < 0) {
			alert('每組派往遠洋與近海的船數合計，\n不能超過該組的船隊總船數');
			the_form["ShipsToDeep" + t + "Fld"].focus();
			the_form["ShipsToDeep" + t + "Fld"].select();
			return false;
		}
	}

	// 先設定強制修改報廢漁船價格，今年馬上生效
	parent.setRevokeShipDols(parseInt(the_form.RevokeShipDolsFld.value));

	for (var t = 1; t <= teams; t++) {
		parent.auctionShips[t]  = parseInt(the_form["AuctionShips" + t + "Fld"].value);
		parent.auctionDols[t]   = parseInt(the_form["AuctionDols" + t + "Fld"].value);
		parent.shipPurch[t]     = parseInt(the_form["ShipPurch" + t + "Fld"].value);
		parent.shipPurchDols[t] = parseInt(the_form["ShipPurchDols" + t + "Fld"].value);
		parent.shipSales[t]     = parseInt(the_form["ShipSales" + t + "Fld"].value);
		parent.shipSalesDols[t] = parseInt(the_form["ShipSalesDols" + t + "Fld"].value);
		parent.shipOrders[t]    = parseInt(the_form["ShipOrders" + t + "Fld"].value);
		parent.setShipsAvail(t, 	parseInt(the_form["ShipsAvail" + t + "Fld"].value));
		parent.shipsToDeep[t]   = parseInt(the_form["ShipsToDeep" + t + "Fld"].value);
		parent.shipsToCoast[t]  = parseInt(the_form["ShipsToCoast" + t + "Fld"].value);
		parent.shipsToHarbor[t] = parseInt(the_form["ShipsToHarbor" + t + "Fld"].value);

		// 報廢漁船 // 已經在 changeShips 處理過了
		// var rShips = parseInt(the_form["RevokeShips" + t + "Fld"].value);
		// if(parent.getShipsAvail(t) < rShips) {
		// 	alert('組別:' + t + ' ,沒那麼多漁船可以報廢');
		// 	return false;
		// }
		// parent.setRevokeShips(t, rShips);

		var gMoney = parseInt(the_form["GivenDols" + t + "Fld"].value);
		var rMoney = parseInt(the_form["ReceiveDols" + t + "Fld"].value);
		var rMoneyFromFishery = parseInt(the_form["ReceiveDolsFromFishery" + t + "Fld"].value);

		if (gMoney) {
			var cMoney = parent.getBankBal(t);
			parent.setBankBal(t, cMoney-gMoney);
			parent.setGivenDols(t, gMoney);
		}

		if (rMoney) {
			var cMoney = parent.getBankBal(t);
			parent.setBankBal(t, cMoney+rMoney);
			parent.setReceiveDols(t, rMoney);
		}

		if (rMoneyFromFishery) {
			var cMoney = parent.getBankBal(t);
			parent.setBankBal(t, cMoney+rMoneyFromFishery);
			parent.subFisheryfund(rMoneyFromFishery);
			parent.setReceiveDolsFromFishery(t, rMoneyFromFishery);
		}
	}

	// 強制修改魚量，未做負數確認
	parent.setFishPopDeep(parseInt(the_form.FishPopDeepFld.value));
	parent.setFishPopCoast(parseInt(the_form.FishPopCoastFld.value));

	parent.resumeFlag = false;

	// 連續進行幾年
	var continuousForYear = parseInt(the_form.ContinuousForYearFld.value);
	parent.setContinuousForYear(continuousForYear);
	for(var i=1; i<=continuousForYear; i++) {
		// 計算新魚價
		parent.calcFishSalesPrices();

		// If we've gotten this far, we can go ahead and proceed with the turn
		parent.executeTurn();

		// Move the game ahead one year
		parent.advanceGameYear();

		// Calculate salvage value
		parent.salvageValue = parent.calcSalvageValue(parent.getGameYear());

		// Save current game state
		parent.saveGame();
	}

	location.replace('reports.html');

	return true;
}

// Move focus to specified field and select its contents
function skipToFld(fld) {
	fld.focus();
	fld.select();
}

function returnToReports() {
	location.replace('reports.html');
}

function validateFishDeepSalesPrice(fld) {
	return parent.validateFishDeepSalesPrice(fld);
}

function validateFishCoastSalesPrice(fld) {
	return parent.validateFishCoastSalesPrice(fld);
}
