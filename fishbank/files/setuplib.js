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

// // Navigate HTML text input fields with arrow keys
// function setupNavInputWithArrowKeys(){
// 	$('input').keyup(function (e) {
// 		if (e.which == 39) { // right arrow
//       $(this).closest('td').next().find('input').focus();
//
//     } else if (e.which == 37) { // left arrow
//       $(this).closest('td').prev().find('input').focus();
//
//     } else if (e.which == 40) { // down arrow
//       $(this).closest('tr').next().find('td:eq(' + $(this).closest('td').index() + ')').prev().find('input').focus();
//
//     } else if (e.which == 38) { // up arrow
//       $(this).closest('tr').prev().find('td:eq(' + $(this).closest('td').index() + ')').prev().find('input').focus();
//     }
//
//   });
//
//   // un-comment to display key code
//   // $("input").keydown(function (e) {
//   //   alert(e.which);
//   // });
// }

// Handle the page load event for setup.html
function handleLoad() {
	document.SetupYearFrm.InitFishDeepFld.focus();
	document.SetupYearFrm.InitFishDeepFld.select();
	// setupNavInputWithArrowKeys();
}

// 翻譯：revise -> 修正的意思
function reviseTeams() {
	if (confirm('This will erase your\ninitial conditions. Proceed?')) {
		location.replace('teams.html');
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

		location.replace('reports.html');
	}
}

function validateAllFld() {
	var the_form = document.SetupYearFrm;
	var teams = parent.getTeams();

	for (var t = 1; t <= teams; t++) {
		if ( !validateShips(eval("the_form.Ships"+t+"Fld"), t) ) return false;
		if ( !validateBalance(eval("the_form.Balance"+t+"Fld"), t) ) return false;
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You must enter a numeric value between 1\nand the Maximum Fish in the Deep Sea area!');
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
		alert('You must enter a numeric value between 1\nand the Maximum Fish in the Coast area!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		alert('You mast enter a numeric value more than 1!');
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
		parent.setRevokeShipDols(entry);
		field.value = entry;
		return true;
	}
}

function validateRevokeShipFishDeep(field,negallow) {
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
		parent.setRevokeShipFishDeep(entry);
		field.value = entry;
		return true;
	}
}

function validateRevokeShipFishCoast(field,negallow) {
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
