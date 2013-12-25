var headerBuilt = false;

var sort = {
	col: 'rsz',
	dir: 1 // 1 asc, -1 desc
};

var lastUpdateId = 0;
var updateId = 1;

var procRows = {};

NODEMON.connect();
NODEMON.on('update', function(data) {
	if(updateId==1) $('#loading').hide();
	
	updateProcTable(data.proc);
	lastUpdateId = updateId;
	updateId++;
});


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
	var hrow = $('table#proc thead > tr');
	var th;
	
	for(var i=0; i<proc.headers.length; i++) {
		
		th = $('<th>');
		
		th.data({
			'col':  proc.cols[i],
			'sort': proc.sort_modes[i]
		});
		
		th.text(proc.headers[i]);
		
		hrow.append(th);
	}
	
	sortCol = $.inArray('pmem',proc.cols);
	$('#proc thead th:eq('+sortCol+')').addClass('sort-'+sortDir);
	$('#proc thead th').on('click', sortTable);
}


function updateProcTable(proc) {
	var table = $('#proc');
	var tbody = table.find('tbody');
	var hrow = table.find('thead > tr');

	if(!headerBuilt) {
		buildTableHeader(proc);
		headerBuilt = true;
	}
	
	var row, td, text, val, col;
		
	for(var j = 0; j < proc.entries.length; j++) {
		var entry = proc.entries[j];
		
		row = procRows[entry.pid];
		
		if(row == undefined) {
			
			row = $('<tr>');
			
			for(var i = 0; i < proc.cols.length; i++) {
				td = $('<td>').attr({class: proc.cols[i]});
				row.append(td);
			}
			
			tbody.append(row);
			
			procRows[entry.pid] = row;
		}
		
		for(var i = 0; i < proc.cols.length; i++) {
			td = row.find('td.'+proc.cols[i]);
			val = entry[proc.cols[i]];
			
			var sortValue = 0;
			switch(proc.disp_modes[i]) {
				
				case 'percent': sortValue = val*1; break;
				case 'bytes':  sortValue = val*1; break;
				case 'number': sortValue = val*1; break;
				
				case 'state':
				case 'text':
				default:       sortValue = val; break;
			}
			
			td.data('sort-value', sortValue);
			
			
			
			text = '';
			
			switch(proc.disp_modes[i]) {
				case 'percent': text = NODEMON.formatPerc(val); break;
				case 'bytes':   text = NODEMON.formatBytes(val); break;
				case 'state':   text = NODEMON.formatProcState(val); break;
			   
				case 'number':
				case 'text':
				default:        text = val; break;
			}
			
			if(td.text() != text) td.text(text);
		};
		
		row.data('upd',updateId);
	};
	
	for(var pid in procRows) {
		row = procRows[pid];
		if(row.data('upd') != updateId) {
			row.remove();
			delete procRows[pid];
		}
	}
	
	if(sortCol != null) resort();
}