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
			if(!vars.paused && typeof vars.updateHandler == 'function') {
				vars.updateHandler(data);
			}
		});
		
		vars.socket.on('disconnect', function () {
		
			console.log('Disconnected, trying to reconnect...');
			
			// wait a bit
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
	
	on: function(event, handler) {
		if(event == 'update') {
			this.vars.updateHandler = handler;
		}
	},
};
