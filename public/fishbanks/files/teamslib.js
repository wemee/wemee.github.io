// File: teamslib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the Create New Game screen. Populates the
// StartGameFrm fields from global state (was done inline via document.write
// in the frameset era) and handles the About / Begin Game buttons.

// Called by the router after tpl-teams is cloned into #app.
function init_teams() {
	var f = document.StartGameFrm;
	f.OrganizationFld.value = parent.getOrganization();
	f.DateFld.value         = parent.getTodayString();
	f.AttendanceFld.value   = parent.getAttendance();
	f.SessionFld.value      = parent.getSession();
	f.TeamsSel.selectedIndex = parent.getTeams() - 1;
	parent.resetGameYear();
	parent.resetInitFish();
}

function aboutGame() {
	goto('about');
}

function beginGame() {
	var t;
	var sessionName = document.StartGameFrm.SessionFld.value;
	var organization = document.StartGameFrm.OrganizationFld.value;
	var date = document.StartGameFrm.DateFld.value;
	var attendance = document.StartGameFrm.AttendanceFld.value;
	var teams = document.StartGameFrm.TeamsSel.selectedIndex + 1;

	parent.setSession(sessionName);
	parent.setDate(date);
	parent.setAttendance(attendance);
	parent.setOrganization(organization);
	parent.setTeams(teams);

	if (!parent.resumeFlag) {
		parent.initShipsPerTeam = parent.calcInitShipsPerTeam(teams);
		parent.initBankBalPerTeam = parent.calcInitBankBalPerTeam();
		for (t = 1; t<=teams; t++) {
			parent.setBankBal(t, parent.initBankBalPerTeam);
			parent.setShipsAvail(t, parent.initShipsPerTeam);
		}
	}

	goto('setup');
}
