// File: teamslib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the Create New Game screen of the Fishbanks program.
// It contains the code that is specific to this single screen.
//
// Revision History:
//   8/22/2004   Version 8.0
//     Initial release

// Handle the page load event for teams.html
function handleLoad() {
	document.StartGameFrm.TeamsSel.selectedIndex = parent.getTeams() - 1;
	parent.resetGameYear();
	parent.resetInitFish();
}

function aboutGame () {
	location.replace('about.html');
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

	location.replace('setup.html')
}
