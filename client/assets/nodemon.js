NODEMON = {

	vars: {
		socket: null,
		paused: false,
		updateHandler: function(data) {
			console.log(data);
		}
	},
	
	connect: function() {
		
		var self = this;
		var vars = this.vars;
		
		if(vars.socket != null) {
			console.log('Already connected.');
			return;
		}
		
		console.log('Connecting...');
		
		vars.socket = io.connect();
		
		vars.socket.on('update', function (data) {
			if(!vars.paused && data != null && typeof vars.updateHandler == 'function') {
				vars.updateHandler(data);
			}
		});
		
		vars.socket.on('disconnect', function () {
		
			console.log('Disconnected, trying to reconnect...');
			
			// wait a bit & try to re-connect
			setTimeout(function(){
				vars.socket.socket.reconnect();
				console.log('Connected.');
			}, 500);
			
		});
	},
	
	pause: function() {
		this.vars.paused = true;
	},
	
	resume: function() {
		this.vars.paused = false;
	},
	
	// bind handler ('update' event only, for now)
	on: function(event, handler) {
		if(event == 'update') {
			this.vars.updateHandler = handler;
		}
	},

	formatBytes: function(bytes) {
		
		if(bytes == 0) return '-';
		
		if(bytes > 1073741824*1.3) return (Math.round(( bytes / 1073741824 ) * 100 ) / 100) + '\xA0GiB';
		if(bytes > 1048576*1.3) return Math.round( bytes / 1048576 ) + '\xA0MiB';
		if(bytes > 1024*1.3) return Math.round( bytes / 1024 ) + '\xA0KiB';
		
		return bytes + '\xA0B';
	},
	
	_stateLookup: {
		'D': 'IO\xA0wait',
		'R': 'running',
		'S': 'sleep',
		'T': 'stopped',
		'W': 'paging',
		'X': 'dead',
		'Z': 'zombie'
	},
	
	formatProcState: function(state) {
		return this._stateLookup[state] || state;
	},
	
	formatPerc: function(perc) {
		return Math.round(perc*1)+'\xA0%';
	}
};
