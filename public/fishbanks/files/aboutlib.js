// File: aboutlib.js
// Author: Mike Gildersleeve
// Copyright 2004, Dennis L. Meadows
//
// Overview:
// The support module for the About the Game screen. The page is mostly
// static text, so there is no init function — the router will just render
// tpl-about as-is. Only the "返回" button needs JS.

function proceed() {
	goto('teams');
}
