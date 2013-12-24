var path = require('path');
var fs = require('fs');

function getStats(filename) {
	try {
		return fs.lstatSync(filename);
	} catch (e) {
		return false;
	}
}

function fileExists(filename) {
	return getStats(filename) !== false;
}

function resolveThemeDir(theme) {
	var filepath, stats, base;
	
	base = path.join(__dirname, 'client', 'theme');
	
	filepath = path.join(base, theme);
	stats = getStats(filepath);
	if(stats && stats.isDirectory()) return filepath;
	
	return path.join(base, 'default');
}

module.exports.fileExists = fileExists;
module.exports.fileStats = getStats;
module.exports.resolveThemeDir = resolveThemeDir;
