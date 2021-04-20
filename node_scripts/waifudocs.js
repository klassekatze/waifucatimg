var urlm = require('url');
var request = require('cloudscraper').defaults({jar: true});
var sanitize = require('sanitize-filename');
var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
const FileType = require('file-type');
var Jimp = require('jimp');
cheerio.prototype.size = function(){ return this.length; };
var XLSX = require('xlsx');


function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
String.prototype.replaceAll = function(find, replace)
{
	return this.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};
String.prototype.extract = function(prefix, suffix) {
	s = this;
	var i = s.indexOf(prefix);
	if (i >= 0) {
		s = s.substring(i + prefix.length);
	}
	else {
		return '';
	}
	if (suffix) {
		i = s.indexOf(suffix);
		if (i >= 0) {
			s = s.substring(0, i);
		}
		else {
		  return '';
		}
	}
	return s;
};

const {google} = require('googleapis');
const drive = google.drive({
  version: 'v3',
  auth: 'AIzaSyCt1RmlglvNmYELMe23GKkHFeqft-OCo8Y' // specify your API key here
});
const getFileUpdatedDate = (path) => {
  const stats = fs.statSync(path)
  return stats.mtime
}





//const fileId = '2PACX-1vRHnhULgzO-Zl-JVhFjJdkHENLJBoLE-sJiNpneqfLYzajF-RgESBBkw-ewoh4oc1flhocWxona0S5c';//'1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA';
//var destination = './spreadsheets/'+fileId+'.xlsx';

const oneDayAgo = new Date();
oneDayAgo.setHours(oneDayAgo.getHours() - 24);


var downloadSheet = function(fileId)
{
	var destination = './spreadsheets/'+fileId+'.xlsx';
	if (!fs.existsSync(destination) || +oneDayAgo > +getFileUpdatedDate(destination))
	{
		if(fs.existsSync(destination))
		{
			console.log('deleting 1day+ old sheet '+fileId);
			fs.unlinkSync(destination);
		}
		const dest = fs.createWriteStream(destination);
		drive.files.export(
		{fileId: fileId,	mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
		{responseType: 'stream'},
		function(err, res)
		{
			if (err)
			{
				console.log('err '+err);
			}else
			{
				//console.log(res);
				res.data.pipe(dest).on('close', function (err)
				{
					console.log('done! '+fileId);
					//sleep(300);
				});
			}
		});
	}else
	{
		console.log('sheet '+fileId+' exists and fresh');
	}
}
//downloadSheet('1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA');

var mkheaders = function(url)
{
	var headers = {
	//'Accept-Encoding': '',
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) AppleWebKit 537.36 (KHTML, like Gecko) Chrome',
	//'content-type': 'application/x-www-form-urlencoded',
	//'X-Requested-With': 'XMLHttpRequest',
	'origin': url,
	'referer': url,
	'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
	};
	return headers;
}



var WAIFU_SPREADSHEET_DIR = 'spreadsheets';
try{fs.mkdirSync(WAIFU_SPREADSHEET_DIR);}catch(e){}
var sheet_urls = [
'https://docs.google.com/spreadsheets/d/1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA/edit?usp=sharing',
'https://docs.google.com/spreadsheets/d/1FM6PNbDEyZV4T4rVLWjPYBc3O0jmmwd1obkFD7jLDt8/edit#gid=2055228227',
'https://docs.google.com/spreadsheets/d/10zOZGNxbMTNrFs0lMR8N_Rqll4X27pbOj7sfXudHpcQ/edit#gid=219891341',
'https://docs.google.com/spreadsheets/u/0/d/1BSw5dsOQvqHNIGAgcLq3xGPlODWhVdArw9_U2Kogxb8/htmlview',
'https://docs.google.com/spreadsheets/d/e/2PACX-1vRHnhULgzO-Zl-JVhFjJdkHENLJBoLE-sJiNpneqfLYzajF-RgESBBkw-ewoh4oc1flhocWxona0S5c/pubhtml',
'https://docs.google.com/spreadsheets/d/e/2PACX-1vT-quTexQHo1mmbQhjm970cdt0XSxhO0il3S9sqRyv05JZUbFWKCzpbEi02agmgtsnTauzCBCLgP_qb/pubhtml',
'https://docs.google.com/spreadsheets/d/1DoJbytcCsLvy2KGo-IzPZ_KEUXy_s4SkKTmHD4Ql8jI/edit#gid=0',
'https://docs.google.com/spreadsheets/d/1nQN8ObqadUaLooZJTcOMpxLwAjvsjs_VSsrWtxJauN8/edit#gid=0',
'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQirsjoQPmQqdmagi6N0PEU466EUfUka9MkDmqm9rTLpAy4jCCin_Ek7bGkdeqdSsyu4hXZwzXcop3/pubhtml',
'https://docs.google.com/spreadsheets/d/1OulCjuJiMjrMObIPhH4H0LCSaawlXkbchRfHeQw1eNI/edit#gid=0',
'https://docs.google.com/spreadsheets/d/e/2PACX-1vRbZEx95nEk-Eu1YKayBTAEZqbyAFKb5dEnB-at-hdnqtfYPRsMzPMogWApyoTEwKCswlLgIdM9M9eO/pubhtml',
'https://docs.google.com/spreadsheets/u/0/d/1yWMYuN0wfNBinc-HAKBb5mo7uCBLQwZ-TK5YX5m2C0o/htmlview#gid=0',
'https://docs.google.com/spreadsheets/d/e/2PACX-1vT9EwIYY4lYV8yb0S3EkiBJsISBGfn9S2Hapxga5b1ISwCj5J5dDvq9cRok3CQm-XduSvLsWXjKYku-/pubhtml',
'https://docs.google.com/spreadsheets/d/15Y1lEBWSUHUGL3N3VSgfMvnxeqXKxu-x0l8Y37LX4kY/edit#gid=0',
'https://docs.google.com/spreadsheets/d/e/2PACX-1vSydV7KUi1CUStqLzh8mOjJg19i_Kf4YLvIXB10BOiPH2clcThTHqS5S263Yip580SwSyYhUKDXV059/pubhtml',
'https://docs.google.com/spreadsheets/d/1qr71AQ05uhKiUuIHcBJ7VsLgiKehgaffQfjiLV51HmQ/edit#gid=0',
'https://docs.google.com/spreadsheets/d/1uuh8bGt-HOk3sn3P8oz7v7dcvcjKsr_UI-Fku6B_mdM/edit#gid=1276256432',
'https://docs.google.com/spreadsheets/d/1fWm-X_JVGTbLtSVmjgmDbQz5ND77VSmCi6jgbLIdBnk/edit#gid=0',
];

try{fs.mkdirSync(WAIFU_SPREADSHEET_DIR);}catch(e){}


const downloadPath = path.resolve(WAIFU_SPREADSHEET_DIR);
const puppeteer = require('puppeteer');
var xlsxurl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRHnhULgzO-Zl-JVhFjJdkHENLJBoLE-sJiNpneqfLYzajF-RgESBBkw-ewoh4oc1flhocWxona0S5c/pub?output=xlsx';

function sleep(time) {
    var stop = new Date().getTime();
    while(new Date().getTime() < stop + time) {
        ;
    }
}




(async () => {
	const browser = await puppeteer.launch({
  headless: false,
  dumpio: true,
});
	const page = await browser.newPage();
	await page._client.send('Page.setDownloadBehavior', {
		behavior: 'allow',
		downloadPath: downloadPath,
	});
	
	console.log('iterating '+sheet_urls.length+' sheets');
	for(var i = 0; i < sheet_urls.length; i++)
	{
		var url = sheet_urls[i];
		var xlsxurl = '';
		if(url.indexOf('docs.google.com') != -1 && url.indexOf('edit') != -1 && url.indexOf('pubhtml') == -1)
		{
			var fileId = url.extract('spreadsheets/d/','/');
			xlsxurl = 'https://docs.google.com/spreadsheets/d/'+fileId+'/export?format=xlsx&id='+fileId;
			
		}else if(url.indexOf('docs.google.com') != -1 && url.indexOf('/u/0/d/') != -1 && url.indexOf('pubhtml') == -1)
		{
			var fileId = url.extract('/u/0/d/','/');
			xlsxurl = 'https://docs.google.com/spreadsheets/d/'+fileId+'/export?format=xlsx&id='+fileId;
			
		}else if(url.indexOf('2PACX') != -1)
		{
			var fileId = '2PACX-'+url.extract('2PACX-','/');
			xlsxurl = 
			'https://docs.google.com/spreadsheets/d/e/'+fileId+'/pub?output=xlsx';
			
		}
		if(xlsxurl != '')
		{
			console.log('navigating to '+xlsxurl);
			try
			{
				await page.goto(xlsxurl);
			}catch(e){}
		}
	}
	
	
	
	
	
	sleep(2000);
	await browser.close();
})();
		/*var fileId = '2PACX-'+url.extract('2PACX-','/');
	
	
	
	
	
	
	
	
	
	
	await page.goto(xlsxurl);
	//await page.screenshot({ path: 'example.png' });
await browser.close();
})();
	


///var workbook = XLSX.readFile(destination);


//		console.log(workbook);

/*
const dest = fs.createWriteStream(destination);
let progress = 0;

drive.files.export({fileId: fileId,	mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},{responseType: 'stream'}, function(err, res)
{
	if (err)
	{
		console.log('err '+err);
	}else
	{
		console.log(res);
		res.data.pipe(dest).on('close', function (err)
		{
			console.log('piped');
		});
	}
});*/



/*.then(res => {
    res.data
      .on('end', () => {
        console.log('Done downloading file.');
      })  
      .on('error', err => {
        console.error('Error downloading file.');
      })  
      .on('data', d => {
        progress += d.length;
        if (process.stdout.isTTY) {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(`Downloaded ${progress} bytes`);
        }   
      })  
      .pipe(dest);
  }); */


/*.on('end', function () {
      console.log('Done');
    })
    .on('error', function (err) {
      console.log('Error during download', err);
    })
    .pipe(destination);*/


/*,{responseType: 'stream'}, function(err, res)
{
	console.log(res.data);
	/*if (err)
	{
		console.log('err '+err);
	}else
	{
		res.data.pipe(destination);
		console.log('piped');
	}*/
//});


/*drive.files.export({
            fileId: fileId,
            mimeType: 'application/pdf'
        }, {
            responseType: 'arraybuffer'
        },function(err, response){
            //response.data can be written to file as expected
			console.log('yay');
			var destination = './spreadsheets/'+fileId+'.xlsx';
			response.data.on('error', function (err)
			{
				console.log('error!');
			}).pipe(fs.createWriteStream(destination))
			.on('error', function (err)
			{
				console.log('error on pipe '+err);
				sleep(100);
			}).on('close', function (err)
			{
				console.log('finished saving');
				sleep(100);
			});
			
			
			
			//fs.writeFileSync('./spreadsheets/'+fileId+'.xlsx',response.data);
       });*/

/*
const fileId = '1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA';
  const destPath = path.join(os.tmpdir(), 'spreadsheets/1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA.xlsx');
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.export(
    {fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
    {responseType: 'stream'}
  );
  await new Promise((resolve, reject) => {
    res.data
      .on('error', reject)
      .pipe(dest)
      .on('error', reject)
      .on('finish', resolve);
  });*/

/*
var fileId = '1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA';
var dest = fs.createWriteStream('/spreadsheets/1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA.xlsx');
drive.files.export({
  fileId: fileId,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}).on('end', function () {
      console.log('Done');
    })
    .on('error', function (err) {
      console.log('Error during download', err);
    })
    .pipe(dest);

*/

/*

var api = '1025745528792-729n7iu9rfphrb8i0pauoh1ohog02nvm.apps.googleusercontent.com';


var WAIFU_SPREADSHEET_DIR = 'spreadsheets';

try{fs.mkdirSync(WAIFU_SPREADSHEET_DIR);}catch(e){}



var sheet_urls = [
'https://docs.google.com/spreadsheets/d/1uY2eb4G1wwBRJSoq5Zq4-61N2VhJLz5t6bEEfLsGJFA/edit?usp=sharing',
];
for(var i = 0; i < sheet_urls.length; i++)
{
	var url = sheet_urls[i];
	if(url.indexOf('docs.google.com') != -1 && url.indexOf('pubhtml') == -1)
	{
		var code = url.extract('spreadsheets/d/','/');
		var xlsxurl = 'https://docs.google.com/spreadsheets/d/'+code+'/export?format=xlsx';
		console.log(xlsxurl);
		
		var nurl = "https://sheets.googleapis.com/v4/spreadsheets/" + code + "/values/" + sheetId + "?key=" + apiKey;
		
		
		
		/*var headers = mkheaders(xlsxurl);
		var reqo = request({url:xlsxurl,headers:headers,followRedirect:true,followAllRedirects:true}, function (error, res, body)
		{
			if (!error && res.statusCode == 200)
			{
				fs.writeFileSync(code+'.xlsx', body);
			}else
			{
				console.log(body);
			}
		});*/
/*	}
}
*/






