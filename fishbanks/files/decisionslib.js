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
      $(this).closest('td').next().find('input').focus().select();
    } else if (e.which == 37) { // left arrow
      $(this).closest('td').prev().find('input').focus().select();
    } else if (e.which == 40) { // down arrow
      $(this).closest('tr').next().find('td:eq(' + $(this).closest('td').index() + ')').prev().find('input').focus().select();
    } else if (e.which == 38) { // up arrow
      $(this).closest('tr').prev().find('td:eq(' + $(this).closest('td').index() + ')').prev().find('input').focus().select();
    }
  });

  // un-comment to display key code
  // $("input").keydown(function (e) {
  //   alert(e.which);
  // });
}

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
	auctionShips = parseInt(eval("the_form.AuctionShips" + t + "Fld.value"));
	purchShips = parseInt(eval("the_form.ShipPurch" + t + "Fld.value"));
	salesShips = parseInt(eval("the_form.ShipSales" + t + "Fld.value"));
	revokeShips = parseInt(eval("the_form.RevokeShips" + t + "Fld.value"));
	shipsAvailable += (auctionShips + purchShips - salesShips - revokeShips);
	eval("the_form.ShipsAvail" + t + "Fld.value = shipsAvailable");
	updateShipsToHarbor(t);

	updateShipsAvailTotal();
}

function updateAuctionShipsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.AuctionShips" + t + "Fld.value"));
	}

	the_form.AuctionShipsTotalFld.value = total;
}

function updateAuctionDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.AuctionDols" + t + "Fld.value"));
	}

	the_form.AuctionDolsTotalFld.value = total;
}

function updateShipPurchTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipPurch" + t + "Fld.value"));
	}

	the_form.ShipPurchTotalFld.value = total;
}

function updateShipPurchDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipPurchDols" + t + "Fld.value"));
	}

	the_form.ShipPurchDolsTotalFld.value = total;
}

function updateShipSalesTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipSales" + t + "Fld.value"));
	}

	the_form.ShipSalesTotalFld.value = total;
}

function updateShipSalesDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipSalesDols" + t + "Fld.value"));
	}

	the_form.ShipSalesDolsTotalFld.value = total;
}

function updateShipOrdersTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipOrders" + t + "Fld.value"));
	}

	the_form.ShipOrdersTotalFld.value = total;
}

function updateShipsAvailTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipsAvail" + t + "Fld.value"));
	}

	the_form.ShipsAvailTotalFld.value = total;
}

function updateShipsToDeepTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipsToDeep" + t + "Fld.value"));
	}

	the_form.ShipsToDeepTotalFld.value = total;
}

function updateShipsToCoastTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipsToCoast" + t + "Fld.value"));
	}

	the_form.ShipsToCoastTotalFld.value = total;
}

function updateShipsToHarborTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ShipsToHarbor" + t + "Fld.value"));
	}

	the_form.ShipsToHarborTotalFld.value = total;
}

function updateGivenDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.GivenDols" + t + "Fld.value"));
	}

	the_form.GivenDolsTotalFld.value = total;
}

function updateReceiveDolsTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ReceiveDols" + t + "Fld.value"));
	}

	the_form.ReceiveDolsTotalFld.value = total;
}

function updateReceiveDolsFromFisheryTotal() {
	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.ReceiveDolsFromFishery" + t + "Fld.value"));
	}

	the_form.ReceiveDolsFromFisheryTotalFld.value = total;
}

function updateRevokeShipTotal(){

	var the_form = document.DecisionsFrm;
	var teams = parent.getTeams();
	var total = 0;

	for (var t = 1; t <= teams; t++) {
		total += parseInt(eval("the_form.RevokeShips" + t + "Fld.value"));
	}

	the_form.RevokeShipTotalFld.value = total;
}

function updateShipsToHarbor(team) {
	var the_form = document.DecisionsFrm;
	var total = 0;

	total = parseInt(eval("the_form.ShipsAvail" + team + "Fld.value"));
	total -= parseInt(eval("the_form.ShipsToDeep" + team + "Fld.value"));
	total -= parseInt(eval("the_form.ShipsToCoast" + team + "Fld.value"));
	eval("the_form.ShipsToHarbor" + team + "Fld.value = total");

	updateShipsToHarborTotal();
}

// Ensure that the referenced text field contains a numeric value. If not, generate
// an error dialog and the reset focus to the offending field and select its contents.
// The value is truncated to an integer value.
// If negallow is true, negative values are acceptable.
function validateDec(field,negallow) {
	var entry = parseInt(field.value)
	if (isNaN(entry) || field.value == "") {
		alert('You must use a numeric\nvalue in this field');
		field.focus();
		field.select();
		return false;
	} else if (!negallow && entry < 0) {
		alert('You must use a non-negative\nvalue in this field');
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
		alert('You must use a numeric\nvalue in this field');
		field.focus();
		field.select();
		return false;
	} else if (entry < 1) {
		// alert('You must use a non-negative\nvalue in this field');
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
		alert('You must use a numeric\nvalue in this field');
		field.focus();
		field.select();
		return false;
	} else if (!negallow && entry < 0) {
		alert('You must use a non-negative\nvalue in this field');
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
		alert('Total of D3, Ship Purchases, must\nequal the Total of D5, Ship Sales');
		the_form.ShipPurch1Fld.focus();
		the_form.ShipPurch1Fld.select();
		return false;
	}

	var totalShipPurchDols = parseInt(the_form.ShipPurchDolsTotalFld.value);
	var totalShipSalesDols = parseInt(the_form.ShipSalesDolsTotalFld.value);
	if (totalShipPurchDols != totalShipSalesDols) {
		alert('Total of D4, Ship Purchases $, must\nequal the Total of D6, Ship Sales $');
		the_form.ShipPurchDols1Fld.focus();
		the_form.ShipPurchDols1Fld.select();
		return false;
	}

	var totalGivenDols = parseInt(the_form.GivenDolsTotalFld.value);
	var totalReceiveDols = parseInt(the_form.ReceiveDolsTotalFld.value);
	if (totalGivenDols != totalReceiveDols) {
		alert('Total of D12, 給出去的錢,\n跟收到的錢 Total of D13, 不相等');
		the_form.GivenDols1Fld.focus();
		the_form.GivenDols1Fld.select();
		return false;
	}

	var teams = parent.getTeams();
	var shipsAvail;
	var shipsOrdered;
	var shipsToHarbor;

	for (var t = 1; t <= teams; t++) {
		shipsAvail = parseInt(eval('the_form.ShipsAvail' + t + 'Fld.value'));
		if (shipsAvail < 0) {
			alert('Available Ships for Team ' + t + '\nmay not be less than 0');
			eval('the_form.ShipPurch' + t + 'Fld.focus()');
			eval('the_form.ShipPurch' + t + 'Fld.select()');
			return false;
		}
		shipsOrdered = parseInt(eval('the_form.ShipOrders' + t + 'Fld.value'));
		if (shipsOrdered > Math.round(shipsAvail/2)) {
			alert('No team may order in one year more\nships than half their existing fleet');
			eval('the_form.ShipOrders' + t + 'Fld.focus()');
			eval('the_form.ShipOrders' + t + 'Fld.select()');
			return false;
		}

		shipsToHarbor = parseInt(eval('the_form.ShipsToHarbor' + t + 'Fld.value'));
		if (shipsToHarbor < 0) {
			alert('The sum of ships sent to the Deep Sea and\nto the Coast fisheries for each team must be less\nthan or equal to the Ships Available');
			eval('the_form.ShipsToDeep' + t + 'Fld.focus()');
			eval('the_form.ShipsToDeep' + t + 'Fld.select()');
			return false;
		}
	}

	// 先設定強制修改報廢漁船價格，今年馬上生效
	parent.setRevokeShipDols(parseInt(the_form.RevokeShipDolsFld.value));

	for (var t = 1; t <= teams; t++) {
		parent.auctionShips[t]  = parseInt(eval("the_form.AuctionShips"  + t + "Fld.value"));
		parent.auctionDols[t]   = parseInt(eval("the_form.AuctionDols" 	 + t + "Fld.value"));
		parent.shipPurch[t]     = parseInt(eval("the_form.ShipPurch" 		 + t + "Fld.value"));
		parent.shipPurchDols[t] = parseInt(eval("the_form.ShipPurchDols" + t + "Fld.value"));
		parent.shipSales[t]     = parseInt(eval("the_form.ShipSales" 		 + t + "Fld.value"));
		parent.shipSalesDols[t] = parseInt(eval("the_form.ShipSalesDols" + t + "Fld.value"));
		parent.shipOrders[t]    = parseInt(eval("the_form.ShipOrders" 	 + t + "Fld.value"));
		parent.setShipsAvail(t, 	parseInt(eval("the_form.ShipsAvail" 	 + t + "Fld.value")));
		parent.shipsToDeep[t]   = parseInt(eval("the_form.ShipsToDeep"   + t + "Fld.value"));
		parent.shipsToCoast[t]  = parseInt(eval("the_form.ShipsToCoast"  + t + "Fld.value"));
		parent.shipsToHarbor[t] = parseInt(eval("the_form.ShipsToHarbor" + t + "Fld.value"));

		// 報廢漁船 // 已經在 changeShips 處理過了
		// var rShips = parseInt(eval("the_form.RevokeShips" + t + "Fld.value"));
		// if(parent.getShipsAvail(t) < rShips) {
		// 	alert('組別:' + t + ' ,沒那麼多漁船可以報廢');
		// 	return false;
		// }
		// parent.setRevokeShips(t, rShips);

		var gMoney = parseInt(eval("the_form.GivenDols" + t + "Fld.value"));
		var rMoney = parseInt(eval("the_form.ReceiveDols" + t + "Fld.value"));
		var rMoneyFromFishery = parseInt(eval("the_form.ReceiveDolsFromFishery" + t + "Fld.value"));

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
