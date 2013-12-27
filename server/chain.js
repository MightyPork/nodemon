/* Queue implementation (chain given array of async tasks)*/
function chain() {

	var chain = {};
	chain.steps = arguments;
	chain.length = chain.steps.length;
	chain.last = null;
	
	chain.next = function(obj) {
		if (obj.__index < chain.length) {
			chain.steps[obj.__index++](chain.next, obj);
		} else if(typeof chain.last == 'function') {
			delete obj.__index;
			chain.last(obj);
		}
	};
	
	chain.start = function(last, obj) {
		chain.last = last;
		obj.__index = 0;
		chain.next(obj);
	};
	
	return chain;
}

module.exports.chain = chain;
