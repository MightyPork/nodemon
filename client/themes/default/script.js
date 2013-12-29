var updateId = 1;

$(document).ready(function(){
	
	NODEMON.connect();
	NODEMON.on('update', function(data) {
		if(updateId==1) $('#loading').hide();
		
		updateProcTable(data.proc);
		
		updateSidebar(data);
		
		if(updateId==1) $('#proc').show();
			
		updateId++;
	});
	
	$(window).on('resize', adaptToScreenSize);
	
	sbw = scrollbarWidth();
	adaptToScreenSize();
});


function scrollbarWidth() {
	var $inner = $('<div style="width: 100%; height:200px;">test</div>'),
		$outer = $('<div style="width:200px;height:150px; position: absolute; top: 0; left: 0; visibility: hidden; overflow:hidden;"></div>').append($inner),
		inner = $inner[0],
		outer = $outer[0];
	
	$('body').append(outer);
	var width1 = inner.offsetWidth;
	$outer.css('overflow', 'scroll');
	var width2 = outer.clientWidth;
	$outer.remove();

	return (width1 - width2);
}

var sbw = 0;
function adaptToScreenSize() {
	
	var sidebarWidth = 350;
	
	var w = $(window).width();
	var h = $(window).height();
	var sb = $('#sidebar');
	var tb = $('#tablebox');
	var proc = $('#proc');
	
	sb.height(h);
	tb.height(h);
	
	tb.width(w-sidebarWidth);
	proc.css('width', w-sidebarWidth-sbw);
}



var table_cfg = [
	{ header: 'PID',     col: 'pid'   },
	{ header: 'Task',    col: 'comm'  },
	{ header: 'User',    col: 'user'  },
	{ header: '%CPU',    col: 'pcpu'  },
	{ header: '%MEM',    col: 'pmem'  },
	{ header: 'RMEM',    col: 'rsz'   },
	{ header: 'VMEM',    col: 'vsz'   },
	{ header: 'State',   col: 'state' },
	{ header: 'Nice',    col: 'nice'  },
	{ header: 'Pri',     col: 'pri'   },
	{ header: 'Command', col: 'args'  },
];


var sortDir = 'desc';
var sortCol = null;
function sortTable(e) {
	var th = $(e.currentTarget);
	var nr = th.index();
	
	if(sortCol != nr) {
		sortDir = 'desc';
	} else {
		sortDir = sortDir=='asc' ? 'desc' : 'asc';
	}
	
	th.siblings().addBack().removeClass('sort-asc sort-desc');
	th.addClass('sort-' + sortDir);
	sortCol = nr;
	resort();
}

function resort() {
	if(sortCol!=null) $('#proc>tbody>tr').tsort('td:eq('+sortCol+')',{order:sortDir,data:'sort-value'});
}

function buildTableHeader(proc) {
	var hrow = $('#proc thead > tr');
	var th;
	
	for(var i=0; i < table_cfg.length; i++) {
		
		th = $('<th>');
		
		th.text(table_cfg[i].header);
		th.addClass(table_cfg[i].col);
		
		th.append('<span class="sort-arrow-asc">↓</span><span class="sort-arrow-desc">↑</span>');
		
		hrow.append(th);
	}
	
	th = $('#proc thead th.rsz');
	th.addClass('sort-'+sortDir); // indicate defualt sort column
	sortCol = th.index();
	
	$('#proc thead th').on('click', sortTable);

}


var procRows = {};
var headerBuilt = false;
function updateProcTable(proc) {
	var table = $('#proc');
	var tbody = table.find('tbody');
	var hrow = table.find('thead > tr');

	if(!headerBuilt) {
		buildTableHeader(proc);
		headerBuilt = true;
	}
	
	var row, td, text, val, col, sm;
		
	for(var j = 0; j < proc.entries.length; j++) {
		var entry = proc.entries[j];
		
		row = procRows[entry.pid];
		
		if(row == undefined) {
			
			row = $('<tr>');
			
			for(var i = 0; i < table_cfg.length; i++) {
				col = table_cfg[i].col;
				td = $('<td>').attr({class: col});
				
				sm = proc.layout[col].sort_mode;
				if(sm == 'string') {
					td.css('text-align','left');
				} else {
					td.css('text-align','right');
				}
			
				row.append(td);
			}
			
			
			tbody.append(row);
			
			procRows[entry.pid] = row;
		}
		
		for(var i = 0; i < table_cfg.length; i++) {
			
			var col = table_cfg[i].col;
			
			td = row.find('td.'+col);
			if(td.length==0) continue;
			
			val = entry[col];
			
			// value for sorting
			td.data('sort-value', val);
			
			// displayed text
			text = '';
			switch(proc.layout[col].disp_mode) {
				case 'percent': text = NODEMON.formatPerc(val); break;
				case 'bytes':   text = NODEMON.formatBytes(val); break;
				case 'state':   text = NODEMON.formatProcState(val); break;
			   
				case 'number':
				case 'text':
				default:        text = val; break;
			}
			if(td.text() != text) {
				td.text(text);
				if(col=='comm' || col=='args') td.attr('title',text);
			}
		};
		
		row.data('upd',updateId);
	};
	
	// remove processes that died since last update
	for(var pid in procRows) {
		row = procRows[pid];
		if(row.data('upd') != updateId) {
			row.remove();
			delete procRows[pid];
		}
	}
	
	if(sortCol != null) resort();
}


// sidebar magic

function updateSidebar(data) {
	updateSystemTable(data);
	updateResourceMeters(data);
	updateCores(data);
	updateDiskMeters(data);
	updateSensorsTable(data);
}

function updateSystemTable(data) {
	
	var rows = [
		['Name',             data.network.hostname,    'sys-hostname'],
		['IP address',       data.network.ip,          'sys-ip'],
		['Uptime',           data.system.uptime,       'sys-uptime'],
		['Load 1/5/15 min',  data.system.load1+' % / '+data.system.load5+' % / '+data.system.load15+' %', 'sys-load']
	];
	
	if(updateId==1) {
		var tbody = $('#table-system tbody');
		tbody.empty();
		
		for(var i=0; i<rows.length; i++) {
			var row = rows[i];
			
			var tr = $('<tr>');
			$('<td>').addClass('sb-box-table-key').text(row[0]).appendTo(tr);
			$('<td>').addClass('sb-box-table-value').attr('id', row[2]).appendTo(tr);
			
			tr.appendTo(tbody);
		}
	}
	
	for(var i=0; i<rows.length; i++) {
		var row = rows[i];
		$('#'+row[2]).text(row[1]);
	}
}


function updateResourceMeters(data) {
	if(updateId==1) {
		var container = $('#container-resource-meters');
		container.empty();
		
		var bar;
		
		bar = $('<div>').addClass('usage-bar cpu').appendTo(container);
		$('<div>').addClass('usage-bar-fill').attr('id','meter-cpu-fill').appendTo(bar);
		$('<div>').addClass('usage-bar-label left').text('CPU load').appendTo(bar);
		$('<div>').addClass('usage-bar-label right').attr('id','meter-cpu-value').appendTo(bar);
		
		bar = $('<div>').addClass('usage-bar ram').appendTo(container);
		$('<div>').addClass('usage-bar-fill').attr('id','meter-ram-fill').appendTo(bar);
		$('<div>').addClass('usage-bar-label left').text('RAM usage').appendTo(bar);
		$('<div>').addClass('usage-bar-label right').attr('id','meter-ram-value').appendTo(bar);
	}
	
	var cpu = Math.round((data.cpu.user+data.cpu.system)*1);
	$('#meter-cpu-fill').css('width', cpu+'%');
	$('#meter-cpu-value').text(NODEMON.formatPerc(cpu));
	
	var ramAbs = (data.memory.active)*1;
	var ram = Math.round((data.memory.active/data.memory.total)*100);
	$('#meter-ram-fill').css('width', ram+'%');
	$('#meter-ram-value').text(NODEMON.formatBytes(ramAbs)+' ('+NODEMON.formatPerc(ram)+')');
}


function updateCores(data) {
	if(updateId==1) {
		var container = $('#container-cores');
		container.empty();
		
		var core;
		
		for(var i=0; i<data.cores.length; i++) {
			core = $('<div>').addClass('core').appendTo(container);
			$('<div>').addClass('core-name').text('Core '+(i+1)).appendTo(core);
			$('<div>').addClass('core-freq').attr('id','core-'+i+'-freq').appendTo(core);
		}
	}
	
	for(var i=0; i<data.cores.length; i++) {
		$('#core-'+i+'-freq').text(Math.round(data.cores[i].freq_mhz)+'\xA0MHz');
	}
}


function updateDiskMeters(data) {
	if(updateId==1) {
		var container = $('#container-disk-meters');
		container.empty();
		
		var bar;
		
		for(var i=0; i<data.disks.length; i++) {
			bar = $('<div>').addClass('usage-bar disk').appendTo(container);
			$('<div>').addClass('usage-bar-fill').attr('id','meter-disk-'+i+'-fill').appendTo(bar);
			$('<div>').addClass('usage-bar-label left').text(data.disks[i].mount).attr('title',data.disks[i].drive).appendTo(bar);
			$('<div>').addClass('usage-bar-label right').attr('id','meter-disk-'+i+'-value').appendTo(bar);
		}
	}
	
	for(var i=0; i<data.disks.length; i++) {
		
		var used = data.disks[i].used;
		var total = data.disks[i].total;
		var free = data.disks[i].free;
		var perc = data.disks[i].pused;
		
		$('#meter-disk-'+i+'-fill').css('width',perc+'%');
		
		$('#meter-disk-'+i+'-value')
			.text(NODEMON.formatPerc(perc))
			.attr('title','Total: '+NODEMON.formatBytes(total)+', Used: '+NODEMON.formatBytes(used)+', Free: '+NODEMON.formatBytes(free));
	}
}



function updateSensorsTable(data) {
	
	var tbody = $('#table-sensors tbody');
	tbody.empty();
	
	var keys = ['temperature','cooling','voltage','power'];
	
	for(var i=0; i<keys.length; i++) {
		var k = keys[i];
		if(data.sensors[k]==undefined) continue;
		for(var j=0; j<data.sensors[k].length; j++) {
			var sensor = data.sensors[k][j];
			
			var tr = $('<tr>');
			$('<td>').addClass('sb-box-table-key').text(sensor.name).appendTo(tr);
			$('<td>').addClass('sb-box-table-value').text(sensor.value).appendTo(tr);
			
			if(i!=0&&j==0) tr.addClass('sb-box-table-rowspacer');
			
			tr.appendTo(tbody);
		}
	}
}