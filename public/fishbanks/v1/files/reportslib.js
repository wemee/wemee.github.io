// File: reportslib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the Reports screens of the Fishbanks program.
// It contains the code that is specific to this single screen.
//
// Revision History:
//   8/22/2004   Version 8.0
//     Initial release

// Handle the page load event for reports.html
function handleLoad() {

}

function reviseTeams() {
	if (confirm('This will erase your initial\nconditions. Proceed?')) {
		location.replace('teams.html');
	}
}

function showReport(t) {
	parent.reportType = t;
	location.reload();
}

function gotoDecisions() {
	// if (confirm('Do you have all reports for this year?')) {
		location.replace('decisions.html');
	// }
}

function gotoPreviousYear() {
	parent.resumePreviousYear();
}

function teamGraphReports() {
	location.replace('graphs.html');
}

function generateCSVReport() {
	var csvReport = parent.generateCSVReportInfo() + "\n";
	console.log(csvReport);
	csvReport += parent.generateTeamCSVReport() + "\n";
	csvReport += parent.generateOperatorCSVReport();

	var htmlStr = '<textarea rows="16" cols="75">'+csvReport+'</textarea><p>複製貼到筆記本，副檔名改為.csv就可以用Excel開。(單機版網頁沒方法中的方法)</p>'
	document.getElementById("csv").innerHTML = htmlStr;
}
