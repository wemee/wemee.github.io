// File: setuplib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the Initial Conditions screen of the Fishbanks program.
// It contains the code that is specific to this single screen.
//
// Revision History:
//   8/22/2004   Version 8.0
//     Initial release

// Called by the router after tpl-setup is cloned into #app. Populates the
// year, the dynamic per-team rows, and every static-field value from the
// mainlib globals (these used to be inline document.write blocks), then
// focuses the initial-fish field.
function init_setup() {
	var f = document.SetupYearFrm;
	var teams = parent.getTeams();
	var t, i, html;

	f.YearFld.value = parent.getGameYear();

	html = '';
	for (t = 1; t <= teams; t++) {
		html += '<td class="team">' + t + '</td>';
	}
	for (i = teams; i < 6; i++) { html += '<td>&nbsp;</td>'; }
	document.getElementById('setup-row-team-labels').insertAdjacentHTML('beforeend', html);

	html = '';
	for (t = 1; t <= teams; t++) {
		html += '<td class="team"><input type="text" name="Ships' + t + 'Fld" value="' + parent.getShipsAvail(t) + '" size="7" tabindex="' + (5 + t) + '" /></td>';
	}
	for (i = teams; i < 6; i++) { html += '<td>&nbsp;</td>'; }
	document.getElementById('setup-row-team-ships').insertAdjacentHTML('beforeend', html);

	html = '';
	for (t = 1; t <= teams; t++) {
		html += '<td class="team"><input type="text" name="Balance' + t + 'Fld" value="' + parent.getBankBal(t) + '" size="7" tabindex="' + (15 + t) + '" /></td>';
	}
	for (i = teams; i < 6; i++) { html += '<td>&nbsp;</td>'; }
	document.getElementById('setup-row-team-balance').insertAdjacentHTML('beforeend', html);

	f.MaxFishDeepFld.value           = parent.getMaxFishDeep();
	f.MaxFishCoastFld.value          = parent.getMaxFishCoast();
	f.InitFishDeepFld.value          = parent.getInitFishDeep();
	f.InitFishCoastFld.value         = parent.getInitFishCoast();
	f.OpCostDeepFld.value            = parent.getOpCostDeep();
	f.OpCostCoastFld.value           = parent.getOpCostCoast();
	f.OpCostHarborFld.value          = parent.getOpCostHarbor();
	f.NewShipPriceFld.value          = parent.getNewShipPrice();
	f.SalValBaseFld.value            = parent.getSalValBase();
	f.RevokeShipDolsFld.value        = parent.getRevokeShipDols();
	f.RevokeShipFishDeepFld.value    = parent.getRevokeShipFishDeep();
	f.RevokeShipFishCoastFld.value   = parent.getRevokeShipFishCoast();
	f.FishDeepSalesPriceFld.value    = parent.getFishDeepSalesPrice();
	f.FishCoastSalesPriceFld.value   = parent.getFishCoastSalesPrice();
	f.FisheryfundFld.value           = parent.getFisheryfund();
	f.FishSalesPriceFunctionFld.value = parent.getFishSalesPriceFunction();

	f.StartTurnBtn.value = '進入遊戲 第 ' + parent.getGameYear() + ' 年報表 ';

	f.InitFishDeepFld.focus();
	f.InitFishDeepFld.select();
}

// 翻譯：revise -> 修正的意思
function reviseTeams() {
	if (confirm('此操作會清除起始設定。\n確定要繼續嗎？')) {
		goto('teams');
	}
}

function startTurn() {
	// function validateAllFld 除了驗證資料，還會順便儲存資料
	if (validateAllFld()) {

		if (!parent.resumeFlag) {
			// Set up initial game calculations
			// function initializeGame() 會初始化資料，造成衝突
			// 預設只有Initial Fish可以變動，所以其他資料都有可能又被初始化
			parent.initializeGame(); // To be implemented
		}

		if (!parent.resumeFlag) {
			// Calculate initial salvage value
			parent.salvageValue = parent.calcSalvageValue(parent.getGameYear());
			parent.resumeFlag = false;
		}

		// Save current game state
		parent.saveGame();

		goto('reports');
	}
}

function validateAllFld() {
	var the_form = document.SetupYearFrm;
	var teams = parent.getTeams();

	for (var t = 1; t <= teams; t++) {
		if ( !validateShips(the_form["Ships"+t+"Fld"], t) ) return false;
		if ( !validateBalance(the_form["Balance"+t+"Fld"], t) ) return false;
	}

	var fishSalesPriceFunction = the_form.FishSalesPriceFunctionFld.value;
	parent.setFishSalesPriceFunction(fishSalesPriceFunction);

	return validateMaxFishDeepFld(the_form.MaxFishDeepFld) &&
				 validateMaxFishCoastFld(the_form.MaxFishCoastFld) &&
				 validateInitFishDeep(the_form.InitFishDeepFld) &&
				 validateInitFishCoast(the_form.InitFishCoastFld) &&
				 validateOpCostDeepFld(the_form.OpCostDeepFld) &&
				 validateOpCostCoastFld(the_form.OpCostCoastFld) &&
				 validateOpCostHarborFld(the_form.OpCostHarborFld) &&
				 validateNewShipPriceFld(the_form.NewShipPriceFld) &&
				 validateSalValBaseFld(the_form.SalValBaseFld) &&
				 validateFishDeepSalesPrice(the_form.FishDeepSalesPriceFld) &&
				 validateFishCoastSalesPrice(the_form.FishCoastSalesPriceFld);
				//  validateFishSalesPriceFld(the_form.FishSalesPriceFld);
}

function validateShips(fld, t){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setShipsAvail(t,entry)
		fld.value = entry;
		return true;
	}
}

function validateBalance(fld, t){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setBankBal(t, entry);
		fld.value = entry;
		return true;
	}
}

function validateMaxFishDeepFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setMaxFishDeep(entry);
		fld.value = entry;
		return true;
	}
}

function validateMaxFishCoastFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setMaxFishCoast(entry);
		fld.value = entry;
		return true;
	}
}

function validateInitFishDeep(fld) {
	var entry = parseInt(fld.value);
	var maxFishDeep = parent.getMaxFishDeep();

	if (isNaN(entry) || entry > maxFishDeep || entry < 1) {
		alert('請輸入 1 到遠洋最大魚量\n之間的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setInitFishDeep(entry);
		fld.value = entry;
		return true;
	}
}

function validateInitFishCoast(fld) {
	var entry = parseInt(fld.value);
	var maxFishCoast = parent.getMaxFishCoast();

	if (isNaN(entry) || entry > maxFishCoast || entry < 1) {
		alert('請輸入 1 到近海最大魚量\n之間的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setInitFishCoast(entry);
		fld.value = entry;
		return true;
	}
}

function validateOpCostDeepFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setOpCostDeep(entry);
		fld.value = entry;
		return true;
	}
}
function validateOpCostCoastFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setOpCostCoast(entry);
		fld.value = entry;
		return true;
	}
}
function validateOpCostHarborFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setOpCostHarbor(entry);
		fld.value = entry;
		return true;
	}
}
function validateNewShipPriceFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setNewShipPrice(entry);
		fld.value = entry;
		return true;
	}
}
function validateSalValBaseFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setSalValBase(entry);
		fld.value = entry;
		return true;
	}
}

function validateFisheryFund(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setFisheryfund(entry);
		fld.value = entry;
		return true;
	}
}

// deprecated
function validateFishSalesPriceFld(fld){
	var entry = parseInt(fld.value);
	if (isNaN(entry) || entry < 1) {
		alert('請輸入大於 1 的數字！');
		fld.focus();
		fld.select();
		return false;
	} else {
		parent.setFishSalesPrice(entry);
		fld.value = entry;
		return true;
	}
}

function validateFishDeepSalesPrice(fld) {
	return parent.validateFishDeepSalesPrice(fld);
}

function validateFishCoastSalesPrice(fld) {
	return parent.validateFishCoastSalesPrice(fld);
}

function validateRevokeShipDols(field,negallow) {
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
		parent.setRevokeShipDols(entry);
		field.value = entry;
		return true;
	}
}

function validateRevokeShipFishDeep(field,negallow) {
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
		parent.setRevokeShipFishDeep(entry);
		field.value = entry;
		return true;
	}
}

function validateRevokeShipFishCoast(field,negallow) {
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
		parent.setRevokeShipFishCoast(entry);
		field.value = entry;
		return true;
	}
}

// YearFld
// Ships
// Balance
// MaxFishDeepFld
// MaxFishCoastFld
// InitFishDeepFld
// InitFishCoastFld
// OpCostDeepFld
// OpCostCoastFld
// OpCostHarborFld
// NewShipPriceFld
// SalValBaseFld
// FishSalesPriceFld
