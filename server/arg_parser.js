// get processed CLI args (key-value, flags).
function parse(valueArgs, flagArgs) {
	
	var args = process.argv.splice(2);
	
	var found = {};
	
	var key;
	var nextIsValue = false;
	
	args.forEach(function (val, index, array) {
		if(nextIsValue) {
			found[key] = val;
			nextIsValue = false;
			return;
		}
		
		if(valueArgs.indexOf(val) != -1) {
			key = val;
			nextIsValue = true;
			return;
		}
		
		if(flagArgs.indexOf(val) != -1) {
			found[val] = true;
			return;
		}
	});
	
	return found;
}

// merge equivalent args into one (aliases), use defval if none given.
function uniquify(opts, equal, defval) {
	var target = equal[0]; // first arg is the target name
	
	var value = undefined;
	
	var found = false;
	equal.forEach(function(argName, index, array) {
		if(!found && opts[argName] != undefined) {
			value = opts[argName];
			found = true;
		}
		delete opts[argName]; // remove all the args
	});
	
	if(value == undefined) value = defval; // use defval if none found
	
	opts[target] = value; // add back the target one
}


module.exports.parse = parse;
module.exports.uniq = uniquify;