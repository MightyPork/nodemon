
/**
 * Read command line arguments
 * 
 * @param valueArgs array of allowed argument names that are followed by values
 * @param flagArgs array of allowed flag arguments
 * 
 * @returns object with parsed arguments, flags have true as value.
 */
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

function uniquify(opts, equal, defval) {
	var target = equal[0];
	
	var value = undefined;
	
	var found = false;
	equal.forEach(function(argName, index, array) {
		if(!found && opts[argName] != undefined) {
			value = opts[argName];
			found = true;
		}
		delete opts[argName];
	});
	
	if(value == undefined) {
		value = defval;
	}
	
	opts[target] = value;
}


module.exports.parse = parse;
module.exports.uniq = uniquify;