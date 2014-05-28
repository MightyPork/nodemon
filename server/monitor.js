var exec = require('child_process').exec;
var chain = require('./chain.js').chain;


// interesting bits from /proc/cpuinfo
var CORES_FIELDS = [
	'model name',
	'cpu MHz',
	'cache size',
	'processor',
	'physical id',
	'core id',
];

var CORES_FIELDS_ALIASES = [
	'model',
	'freq_mhz', // MHz
	'cache_size',
	'number',
	'physical_id',
	'core_id',
];


// table of PS fields to be monitored
var COL=0, LEN=1, HEAD=2, FMT=3, SORT=4, DISP=5;

var PS_FIELDS = [
	//   col,  len,   header,    formatter,      sort,    display,   
	[    'pid',    8,    'PID',         null,     'int',   'number' ],
	[   'ppid',    8,   'PPID',         null,     'int',   'number' ],
	[   'nice',    4,   'NICE',         null,     'int',   'number' ],
	[    'pri',    4,    'PRI',         null,     'int',   'number' ],
	[   'pcpu',    6,   '%CPU',         null,   'float',  'percent' ],
	[   'pmem',    6,   '%MEM',         null,   'float',  'percent' ],
	[    'uid',    8,    'UID',         null,     'int',   'number' ],
	[   'user',   20,   'USER',         null,  'string',     'text' ],
	[    'tty',   20,    'TTY',         null,  'string',     'text' ],
	[    'vsz',   12,   'VMEM',    memFromKB,     'int',    'bytes' ],
	[    'rsz',   12,   'RMEM',    memFromKB,     'int',    'bytes' ],
	[  'state',    6,  'STATE',         null,  'string',    'state' ],
	[   'comm',   30,    'CMD',         null,  'string',     'text' ],
	[   'args',    0,   'ARGS',         null,  'string',     'text' ],
];



/* memory formatter (KB based) */
function memFromKB(kbytes) {
	
	return kbytes*1024;
}


/* format with a given formatter */
function format(formatter, value) {
	if(typeof formatter == 'function') return formatter(value);
	return value;
}

/* Comma to period in number string. */
function fixComma(str) {
	return str.replace(',', '.').replace(/[^0-9.]+/g, '');
}


/* == execution chains == */

var static_chain = chain(
	taskProcStatic,
	taskSystem,
	taskNetwork
);

var update_chain = chain(
	taskAddStatic,
	taskCores,
	taskProc,
	taskCpu,
	taskMemory,
	taskDisks,
	taskSensors,
	taskUptime
);



/* collect data that will never change (done only once) */
var data_static = null;
function collectStaticData(handler) {
	data_static = {};
	static_chain.start(handler, data_static);
}



/* start building the update object */
function collectStats(handler) {
	
	if(data_static == null) {
		console.log('Collecting static system info...');
		collectStaticData(function(){
			collectStats(handler);
		});
		return;
	}
	
	update_chain.start(handler, {});
}



/* prepare static stuff for proc entry */
var proc_static = null;
var proc_cmd_static = null;
var PROC_COMMAND = 'ps --no-headers -wwe -o %cols'; // cmd base
function taskProcStatic(callback, obj) {
	
	var cols = '';
	
	proc_static = {
		layout: {},
		order: [],
	};
	
	PS_FIELDS.forEach(function(field, index, array) {
		
		proc_static.layout[ field[COL] ] = {
			header: field[HEAD],
			col: field[COL],
			sort_mode: field[SORT],
			disp_mode:  field[DISP]
		};
		
		proc_static.order.push( field[COL] );
		
		// add stuff to cols string
		if(cols.length > 0) cols += ',';
		cols += field[COL];
		if(field[LEN] != 0) cols += ':' + field[LEN];
	});
	
	proc_cmd_static = PROC_COMMAND.replace('%cols',cols); // command used to fetch processes
	
	callback(obj);
}

/* add static data to update object */
function taskAddStatic(callback, obj) {
	
	// add static data
	for(k in data_static) {
		obj[k] = data_static[k];
	}
	
	callback(obj);
}


function taskSystem(callback, obj) {
	
	obj.system = {};
	
	exec('echo ' +
			'`uname -s` "|" ' +
			'`uname -r` "|" ' +
			'`uname -v` "|" ' +
			'`uname -m` "|" ' +
			'`uname -o`'
			, function(err, stdout, stderr) {

		stdout = stdout.trim();
		var parts = stdout.split('|');
		
		obj.system.kernel = {
			name:     parts[0].trim(),
			release:  parts[1].trim(),
			version:  parts[2].trim()
		};
		
		obj.system.platform = parts[3].trim();
		obj.system.name = parts[4].trim();
		
		callback(obj);
	});
	
}


function taskNetwork(callback, obj) {
	
	obj.network = {};
	
	exec('echo ' +
			'`uname -n` "|" ' +
			'`curl ipecho.net/plain -m 5`'
			, function(err, stdout, stderr) {

		stdout = stdout.trim();
		var parts = stdout.split('|');
		
		obj.network = {
			hostname: parts[0].trim(),
			ip: parts[1].trim(),
		};
		
		callback(obj);
	});
}

/* cores */
function taskCores(callback, obj) {
	
	obj.cores = [];
	
	exec('cat /proc/cpuinfo', function(err, stdout, stderr) {
		
		var coreBlocks = stdout.split('\n\n');
		
		coreBlocks.forEach(function(cb) {
		
			cb = cb.trim();
			
			if(cb.length==0) return; // continue next
			
			var lines = cb.split('\n');
			var core = {};
			
			lines.forEach(function(line) {
				
				line = line.trim();
				
				if (line.length==0) return; // continue next
				
				var match = line.match(/([^:]+):(.*)/i);
				if(match == null) return; // continue next
				
				var k = match[1].trim();
				var v = match[2].trim();
				var ind = CORES_FIELDS.indexOf(k);
				if(ind != -1) core[ CORES_FIELDS_ALIASES[ind] ] = v;
				
			});
			
			obj.cores.push(core);
			
		});
		
		callback(obj);
	});
}


/* proc */
function taskProc(callback, obj) {
	
	// add static stuff
	obj.proc = {};
	for(k in proc_static) {
		obj.proc[k] = proc_static[k];
	}
	
	obj.proc.entries = [];
	
	//sanitize sort
		
	// Run it!
	exec(proc_cmd_static, function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		// parse all lines
		lines.forEach(function(value, index, array) {
			
			if (value.trim().length==0) return;
			
			var process = {};
			
			for(var i=0, pos=0; i<PS_FIELDS.length; i++) {
				
				var to = undefined;
				if(i != PS_FIELDS.length-1) to = pos + PS_FIELDS[i][LEN];
				
				var field = value.substring(pos, to);
				field = format( PS_FIELDS[i][FMT], field.trim() );
				process[ PS_FIELDS[i][COL] ] = field;
				
				pos = to+1;
			}
			
			// try to get better value for "comm"
			if(!process.args.match(/^\[.*\]$/i)) {
				var match = process.args.match(/\/?(?:[^/ ]+\/)*([^/ ]+?):?(?: |$)(?:.*$)?/i);
				
				if(match != null) process.comm = match[1];
			}
			
			obj.proc.entries.push(process);
		});
		
		callback(obj);
	});
}


/* mem */
function taskMemory(callback, obj) {
	
	var memory = {};
	
	exec('vmstat -s -S B | grep memory', function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		lines.forEach(function(value, index, array) {
			
			value = value.trim();
			
			if(value.length==0) return; // continue next
			
			var match = value.match(/([0-9]+)\sB\s(.*) memory/i);
			if(match == null) return; // continue next
			
			memory[match[2]] = match[1]*1;
			
		});
		
		obj.memory = memory;
		callback(obj);
	});
	
}


/* disk */
function taskDisks(callback, obj) {
	
	obj.disks = [];
	
	exec('df -T --block-size=1 -x tmpfs -x devtmpfs', function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		lines.forEach(function(value, index, array) {
			
			if(index==0) return; // skip header
			
			value = value.trim(); // skip blank line
			if (value.length==0) return;
			
			var match = value.match(/([^ ]+)\s+([^ ]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+%)\s+([^ ]+)/i);
	
			if(match == null) return;
			
			var arr = {
				'drive': match[1], // drive
				'type': match[2],  // filesystem
				'total': match[3], // total bytes
				'used': match[4],  // used bytes
				'free': match[5],  // free bytes
				'pused': match[6].replace('%','').trim(), // used percent
				'mount': match[7], // mount point
			};
			
			var bad = false;
			obj.disks.forEach(function(value) {
				
				if(value.mount == arr.mount) {
					bad = true;
				}
				
			});
			
			if(!bad) obj.disks.push(arr);
		});
		
		obj.disks.sort(function(a, b) {
			return ((a.drive < b.drive) ? -1 : ((a.drive > b.drive) ? 1 : 0));
		});
		
		callback(obj);
	});
	
}


/* cpu */
function taskCpu(callback, obj) {
	
	exec('mpstat 2 1', function(err, stdout, stderr) {

		var match = stdout.match(/all .*?([0-9.,]+)\n/i);
		
		if(match != null && match[1] != undefined) {
			obj.cpu = 100.0 - fixComma(match[1]);
		}
		
		callback(obj);
	});
}


/* cpu using TOP */
function taskCpu_old(callback, obj) {
	
	exec('top -b -n 3 -d 0.2', function(err, stdout, stderr) {
		
		var tops = stdout.split('\n\ntop');
		var last_top = tops[tops.length-1].trim();
		var top_parts = last_top.split('\n\n');
		
		if(top_parts.length != 2) {
			console.log('Bad TOP output format.');
			callback(obj); // go no
		}
		
		var sysinfo = top_parts[0].trim();
		var proctable = top_parts[1].trim();
		
		
		var match = sysinfo.match(/Cpu.*:\s*([0-9.,]+).us,\s*([0-9.,]+).sy,\s*([0-9.,]+).ni,\s*([0-9.,]+).id,\s*([0-9.,]+).wa/i);

			console.log(sysinfo);

		
		if(match != null) {
			obj.cpu = {
				'user':   fixComma(match[1])*1, // user (percent)
				'system': fixComma(match[2])*1, // system (percent)
				'nice':   fixComma(match[3])*1, // nice (percent)
				'idle':   fixComma(match[4])*1, // idle (percent)
				'iowait': fixComma(match[5])*1  // iowait (percent)
			};
			
			console.log(JSON.stringify(obj.cpu));
		}
		
		
		var proctable_lines = proctable.split('\n');
		var cpuForPid = {};
		
		proctable_lines.forEach(function(line, index, array) {
			if(index == 0) return; // header
			
			var pid = line.substring(0, 5).trim()*1;
			var cpu = fixComma(line.substring(40, 46).trim())*1;
			
			cpuForPid[pid] = cpu;
		});
		
		obj.proc.entries.forEach(function(entry, index, array) {
			var cpu = cpuForPid[entry.pid];
			
			if(cpu !== undefined) {
				entry.pcpu = cpu / obj.cores.length; // divide load by number of cores
			}
		});
		
		callback(obj);
	});
}

function taskSensors(callback, obj) {
	exec('sensors' + (FAHR ? ' -f' : ''), function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		obj.sensors = {
			temperature: [],
			cooling: [],
			voltage: [],
			power: [],
			other: [],
		};
		
		lines.forEach(function(line, index, array) {
			var match = line.match(/([a-z0-9_\-. ,]+):\s*([0-9A-Za-z/\-+°.,]+)/i);
			if(match == null) return;
			
			var name = match[1].trim();
			var value = match[2].trim();
			
			var target = obj.sensors.other;
			
			if(value.substring(value.length-1) == 'V') {
				
				target = obj.sensors.voltage;
				
			} else if( (value.substring(value.length-2)=='°C') || (value.substring(value.length-2)=='°F') ) {
				
				if(value.charAt(0) == '+') value = value.substring(1);
				
				if(value.charAt(0) == '-'||value == '0.0°C'||value == '0.0°F') {
					target = null;
				} else {
					target = obj.sensors.temperature;
				}
			
			} else if(value.substring(value.length-3) == 'RPM') {
				target = obj.sensors.cooling;
			
			} else if(value.substring(value.length-1) == 'W') {
				
				target = obj.sensors.power;
				
			}
			
			if(target != null) {
				target.push({
					name: name.trim(),
					value: value.trim()
				});
			}
		});
		
		callback(obj);
	});
}

/* disk */
function taskUptime(callback, obj) {
	
	exec('uptime', function(err, stdout, stderr) {
		
		stdout = stdout.trim();
		var match = stdout.match(/.*up\s*(.*?),\s*([0-9]+\s+users?),\s*load averages?:\s*([0-9]+[.,][0-9]+),\s*([0-9]+[.,][0-9]+),\s*([0-9]+[.,][0-9]+).*/i);

		if(match != null) {
			obj.system.uptime = match[1];
			obj.system.users = match[2];
			obj.system.load1 = Math.round((fixComma(match[3])/obj.cores.length)*1000)/10;
			obj.system.load5 = Math.round((fixComma(match[4])/obj.cores.length)*1000)/10;
			obj.system.load15 = Math.round((fixComma(match[5])/obj.cores.length)*1000)/10;
		}
		
		callback(obj);
	});
	
}


module.exports.collectStats = collectStats;
