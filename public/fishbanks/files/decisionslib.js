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
	// 沿著 tr 的 next/previousElementSibling 一直走，直到該列同一欄 (children[idx])
	// 有一個非 disabled 的 input 為止。跨過兩種「跳過去也沒意義」的列：
	//   1. <tr><td colspan="8">&nbsp;</td></tr> 分隔列：children[idx] 不存在。
	//   2. D8 船隊總船數 / D11 港口停船數：children[idx] 有 input 但 disabled，
	//      .focus() 在這上面是 no-op。
	function findEnabledInputInColumn(startTr, idx, dir) {
		var sib = (dir === 'next') ? startTr.nextElementSibling : startTr.previousElementSibling;
		while (sib) {
			var cell = sib.children[idx];
			if (cell) {
				var input = cell.querySelector('input');
				if (input && !input.disabled) return input;
			}
			sib = (dir === 'next') ? sib.nextElementSibling : sib.previousElementSibling;
		}
		return null;
	}

	var inputs = document.querySelectorAll('input');
	for (var i = 0; i < inputs.length; i++) {
		inputs[i].addEventListener('keyup', function (e) {
			var td = this.closest('td');
			if (!td) return;
			var tr = td.parentNode;
			var idx = Array.prototype.indexOf.call(tr.children, td);
			if (e.which == 39) { // right arrow
				var targetTd = td.nextElementSibling;
				if (targetTd) {
					var input = targetTd.querySelector('input');
					if (input) input.focus();
				}
			} else if (e.which == 37) { // left arrow
				var targetTd = td.previousElementSibling;
				if (targetTd) {
					var input = targetTd.querySelector('input');
					if (input) input.focus();
				}
			} else if (e.which == 40) { // down arrow
				var input = findEnabledInputInColumn(tr, idx, 'next');
				if (input) input.focus();
			} else if (e.which == 38) { // up arrow
				var input = findEnabledInputInColumn(tr, idx, 'prev');
				if (input) input.focus();
			}
		});
	}

	// un-comment to display key code
	// for (var j = 0; j < inputs.length; j++) {
	//   inputs[j].addEventListener('keydown', function (e) { alert(e.which); });
	// }
}

// Select text on focus for all text inputs (focusin bubbles, unlike focus)
document.addEventListener('focusin', function (e) {
	if (e.target && e.target.matches && e.target.matches('input[type="text"]')) {
		e.target.select();
	}
});

// Called by the router after tpl-decisions is cloned into #app. Builds
// the dynamic per-team rows (D1-D15) into placeholder <tr> elements,
// populates the static single-input rows (D16-D19, RevokeShipDols,
// ContinuousForYear), then runs the cascade of update*Total() helpers
// so the right-hand totals column reflects the initial values.
function init_decisions() {
	if (!requireGameState()) return;

	var f = document.DecisionsFrm;
	var teams = parent.getTeams();
	var t, i;

	document.getElementById('decisions-year').textContent = parent.getGameYear();

	var headerHTML = '';
	for (t = 1; t <= teams; t++) {
		headerHTML += '<td>' + t + '</td>';
	}
	headerHTML += '<td>合計</td>';
	for (i = teams; i < 6; i++) { headerHTML += '<td>&nbsp;</td>'; }
	document.getElementById('dec-row-header').insertAdjacentHTML('beforeend', headerHTML);

	// Helper that builds and appends per-team input cells + total cell + spacers.
	// opts: { tabBase, value(t), onblur, onchange(t), disabled, totalName }
	function appendDecRow(rowId, name, opts) {
		var html = '';
		for (var t = 1; t <= teams; t++) {
			var val = opts.value ? opts.value(t) : 0;
			html += '<td><input type="text" name="' + name + t + 'Fld" size="5"';
			html += ' value="' + val + '"';
			if (opts.disabled) {
				html += ' tabindex="0" disabled="disabled"';
			} else {
				html += ' tabindex="' + (t * 20 + opts.tabBase) + '"';
				if (opts.onblur) { html += ' onblur="' + opts.onblur + '"'; }
				if (opts.onchange) { html += ' onchange="' + opts.onchange(t) + '"'; }
			}
			html += ' /></td>';
		}
		var totalName = opts.totalName || (name + 'Total');
		html += '<td><input type="text" name="' + totalName + 'Fld" size="5" value="0" tabindex="0" disabled="disabled" /></td>';
		for (var i = teams; i < 6; i++) { html += '<td>&nbsp;</td>'; }
		document.getElementById(rowId).insertAdjacentHTML('beforeend', html);
	}

	appendDecRow('dec-row-d1', 'AuctionShips', {
		tabBase: 1,
		value: function(t) { return parent.resumeFlag ? parent.auctionShips[t] : 0; },
		onblur: 'return validateDec(this,true);',
		onchange: function(t) { return 'changeShips(' + t + ')'; }
	});
	appendDecRow('dec-row-d2', 'AuctionDols', {
		tabBase: 2,
		value: function(t) { return parent.resumeFlag ? parent.auctionDols[t] : 0; },
		onblur: 'return validateDec(this,true);',
		onchange: function() { return 'updateAuctionDolsTotal()'; }
	});
	appendDecRow('dec-row-d3', 'ShipPurch', {
		tabBase: 3,
		value: function(t) { return parent.resumeFlag ? parent.shipPurch[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function(t) { return 'changeShips(' + t + ')'; }
	});
	appendDecRow('dec-row-d4', 'ShipPurchDols', {
		tabBase: 4,
		value: function(t) { return parent.resumeFlag ? parent.shipPurchDols[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function() { return 'updateShipPurchDolsTotal()'; }
	});
	appendDecRow('dec-row-d5', 'ShipSales', {
		tabBase: 5,
		value: function(t) { return parent.resumeFlag ? parent.shipSales[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function(t) { return 'changeShips(' + t + ')'; }
	});
	appendDecRow('dec-row-d6', 'ShipSalesDols', {
		tabBase: 6,
		value: function(t) { return parent.resumeFlag ? parent.shipSalesDols[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function() { return 'updateShipSalesDolsTotal()'; }
	});
	appendDecRow('dec-row-d7', 'ShipOrders', {
		tabBase: 7,
		value: function(t) { return parent.resumeFlag ? parent.shipOrders[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function() { return 'updateShipOrdersTotal()'; }
	});
	appendDecRow('dec-row-d8', 'ShipsAvail', {
		value: function(t) { return parent.getShipsAvail(t); },
		disabled: true
	});
	appendDecRow('dec-row-d9', 'ShipsToDeep', {
		tabBase: 8,
		value: function(t) { return parent.resumeFlag ? parent.shipsToDeep[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function(t) { return 'updateShipsToDeepTotal();updateShipsToHarbor(' + t + ');'; }
	});
	appendDecRow('dec-row-d10', 'ShipsToCoast', {
		tabBase: 9,
		value: function(t) { return parent.resumeFlag ? parent.shipsToCoast[t] : 0; },
		onblur: 'return validateDec(this,false);',
		onchange: function(t) { return 'updateShipsToCoastTotal();updateShipsToHarbor(' + t + ');'; }
	});
	appendDecRow('dec-row-d11', 'ShipsToHarbor', {
		value: function() { return 0; },
		disabled: true
	});
	appendDecRow('dec-row-d12', 'GivenDols', {
		tabBase: 10,
		value: function(t) { return parent.resumeFlag ? parent.givenDols[t] : 0; },
		onblur: 'return validateDec(this,true);',
		onchange: function() { return 'updateGivenDolsTotal()'; }
	});
	appendDecRow('dec-row-d13', 'ReceiveDols', {
		tabBase: 11,
		value: function(t) { return parent.resumeFlag ? parent.receiveDols[t] : 0; },
		onblur: 'return validateDec(this,true);',
		onchange: function() { return 'updateReceiveDolsTotal()'; }
	});
	appendDecRow('dec-row-d14', 'ReceiveDolsFromFishery', {
		tabBase: 12,
		value: function(t) { return parent.resumeFlag ? parent.receiveDolsFromFishery[t] : 0; },
		onblur: 'return validateDec(this,true);',
		onchange: function() { return 'updateReceiveDolsFromFisheryTotal()'; }
	});
	appendDecRow('dec-row-d15', 'RevokeShips', {
		tabBase: 13,
		totalName: 'RevokeShipTotal',  // irregular (no trailing 's')
		value: function() { return 0; },
		onblur: 'return validateRevokeShips(this,false);',
		onchange: function(t) { return 'changeShips(' + t + ')'; }
	});

	// Static single-input fields
	f.FishDeepSalesPriceFld.value  = parent.getFishDeepSalesPrice();
	f.FishCoastSalesPriceFld.value = parent.getFishCoastSalesPrice();
	f.FishPopDeepFld.value         = parent.getFishPopDeep();
	f.FishPopCoastFld.value        = parent.getFishPopCoast();
	f.RevokeShipDolsFld.value      = parent.getRevokeShipDols();
	f.ContinuousForYearFld.value   = parent.resumeFlag ? parent.getContinuousForYear() : 1;

	// Compute initial totals (now that all input rows exist)
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
	updateGivenDolsTotal();
	updateReceiveDolsTotal();
	updateReceiveDolsFromFisheryTotal();
	updateRevokeShipTotal();

	for (t = 1; t <= teams; t++) {
		updateShipsToHarbor(t);
	}

	if (parent.resumeFlag) {
		for (t = 1; t <= teams; t++) {
			changeShips(t);
		}
	}

	f.AuctionShips1Fld.focus();
	f.AuctionShips1Fld.select();

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
		alert('購入總船數合計，必須等於\n售出總船數合計');
		the_form.ShipPurch1Fld.focus();
		the_form.ShipPurch1Fld.select();
		return false;
	}

	var totalShipPurchDols = parseInt(the_form.ShipPurchDolsTotalFld.value);
	var totalShipSalesDols = parseInt(the_form.ShipSalesDolsTotalFld.value);
	if (totalShipPurchDols != totalShipSalesDols) {
		alert('購入總花費合計，必須等於\n售船總收入合計');
		the_form.ShipPurchDols1Fld.focus();
		the_form.ShipPurchDols1Fld.select();
		return false;
	}

	var totalGivenDols = parseInt(the_form.GivenDolsTotalFld.value);
	var totalReceiveDols = parseInt(the_form.ReceiveDolsTotalFld.value);
	if (totalGivenDols != totalReceiveDols) {
		alert('給出去的錢合計，必須等於\n收到的錢合計');
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
	// Clamp: NaN or huge values would loop executeTurn forever (fuzz found a
	// 7-hour hang triggered by pasting an 8-digit number into 連續休魚幾年).
	if (isNaN(continuousForYear) || continuousForYear < 1) {
		alert('連續休魚幾年必須是 1 到 100 之間的整數');
		the_form.ContinuousForYearFld.focus();
		the_form.ContinuousForYearFld.select();
		return false;
	}
	if (continuousForYear > 100) {
		alert('連續休魚幾年最多 100 年');
		the_form.ContinuousForYearFld.focus();
		the_form.ContinuousForYearFld.select();
		return false;
	}
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

	goto('reports');

	return true;
}

// Move focus to specified field and select its contents
function skipToFld(fld) {
	fld.focus();
	fld.select();
}

function returnToReports() {
	goto('reports');
}

// validateFishDeepSalesPrice / validateFishCoastSalesPrice live in
// mainlib.js. The old frameset child shadow wrappers were removed —
// under the SPA shell they recurse into themselves because parent === window.
