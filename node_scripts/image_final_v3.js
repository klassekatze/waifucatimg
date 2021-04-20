var urlm = require('url');
var request = require('cloudscraper').defaults({jar: true});
var sanitize = require('sanitize-filename');
var fs = require('fs');
var cheerio = require('cheerio');
const FileType = require('file-type');
var Jimp = require('jimp');

cheerio.prototype.size = function(){ return this.length; };
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
function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
String.prototype.replaceAll = function(find, replace)
{
	return this.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};




var image_extensions = ['.apng','.bmp','.jpg', '.gif', '.jpeg', '.jfif', '.pjpeg', '.pjp','.png'];
var image_hosts = ['steamuserimages-a.','qph.fs.quoracdn.net','pbs.twimg.com','encrypted-tbn0.gstatic.com'];
var is_direct_link_to_image = function(url)
{
	for(var i  = 0; i < image_extensions.length; i++)
	{
		var url_novar = url.split('?')[0].toLowerCase();
		if(url_novar.endsWith(image_extensions[i]) || (url_novar.indexOf('.wikia.') != -1 && url_novar.indexOf(image_extensions[i]) != -1))return true;
	}
	for(var i  = 0; i < image_hosts.length; i++)
	{
		if(url_novar.indexOf(image_hosts[i]) != -1)return true;
	}
	if(url.indexOf('static.wikia.nocookie.net') != -1 && url.indexOf('/images/') != -1 && url.indexOf('/latest') != -1)
	{
		return true;
	}
	return false;
}

var IMAGE_SITE_SELECTORS = {
'www.deviantart.com':['img[src*="images-wixmp"]'],
'chan.sankakucomplex.com':['#post-content img'],
'danbooru.donmai.us':['#content img#image'],
'gelbooru.com':['#post-view img','.image-container img#image'],
'ibb.co':['#image-viewer-container img'],
'safebooru.org':['#content img'],
'imgur.com':['div.image.post-image img'],
'artgraveyard.tumblr.com':['.post .content img'],
'hellyonwhite.tumblr.com':['main img'],
'greyvestboy.tumblr.com':['main img'],
'lie-ren.tumblr.com':['main img'],
'www.pinterest.com':['[data-test-id="best-pin-card"] img'],
'www.artstation.com':['.artwork-image img'],
'www.zerochan.net':['.preview img'],
'www.pixiv.net':['[role=presentation] img'],
'e621.net':['section#image-container img'],
'rule34.paheal.net':['section#Imagemain img'],
'rule34.xxx':['div.post-view div.content img#image'],
'www.pinterest.co.uk':['[data-test-id="UnauthBestPinCardLayoutContainer"] [data-test-id="pin-closeup-image"] img'],
'funnyjunk.com':['div.mediaContainer .contentImage img'],
'www.comicartcommunity.com':['img.ui.centered.image'],
}


var smartnamedemangler = function(url)
{
	url = url.toLowerCase();
	for(var i  = 0; i < image_extensions.length; i++)
	{
		if(url.indexOf(image_extensions[i]) != -1)
		{
			var tokens = url.split('?')[0].split('/');
			for(var t  = 0; t < tokens.length; t++)
			{
				var curtok = tokens[t];
				if(curtok.indexOf(image_extensions[i]) != -1)
				{
					var ret = curtok;
					if(!ret.endsWith(image_extensions[i]))ret += image_extensions[i];
					ret = ret.replace(/[^a-z0-9\.]/gi, '_').toLowerCase();
					return ret;
				}
			}
		}
	}
	var ret = url.split('/')[url.split('/').length-1].split('?')[0];
	
	while(ret.length < 10)
	{
		ret = Math.floor(Math.random() * 10)+ret;
	}
	ret = ret.replace(/[^a-z0-9\.]/gi, '_').toLowerCase();
	return ret;
}

var getselector = function(host)
{
	var retval = '';
	Object.keys(IMAGE_SITE_SELECTORS).forEach(function(key)
	{
		//console.log(key);
		var value = IMAGE_SITE_SELECTORS[key];
		if(key == host)
		{
			//console.log('ret '+value);
			retval = value;
		}
	});
	return retval;
}
function sleep(time) {
    var stop = new Date().getTime();
    while(new Date().getTime() < stop + time) {
        ;
    }
}

var IMAGE_CACHE_V3 = [];
var read_image_cache = function()
{
	IMAGE_CACHE_V3 = {};
	var str = '';
	try{var str = fs.readFileSync('IMAGE_CACHE_V3.json').toString();}catch(e){}
	if(!str || str == '' || str == 'undefined')str = '{}';
	IMAGE_CACHE_V3 = JSON.parse(str);
}
var write_image_cache = function()
{
	fs.writeFileSync('IMAGE_CACHE_V3.json', ''+JSON.stringify(IMAGE_CACHE_V3, null, '\t'));
}

//addimagecache

function get_create_image_cache_by_url(url)
{
	for(var i = 0; i < IMAGE_CACHE_V3.length; i++)
	{
		var entry = IMAGE_CACHE_V3[i];
		if(entry.url == url)
		{
			return entry;
		}
	}
	var entry= {url:url,file:'',thumb:'',statically:''};
	IMAGE_CACHE_V3.push(entry);
	return entry;
}
function set_image_in_cache(cache)
{
	for(var i = 0; i < IMAGE_CACHE_V3.length; i++)
	{
		var entry = IMAGE_CACHE_V3[i];
		if(entry.url == cache.url)
		{
			IMAGE_CACHE_V3[i] = cache;
			return ;
		}
	}
	//else
	IMAGE_CACHE_V3.push(cache);
}

function imgcache_get_full_file_from_url(url)
{
	return get_create_image_cache_by_url(url).file;
}
function imgcache_get_thumb_from_url(url)
{
	return get_create_image_cache_by_url(url).thumb;
}
//imgcache_set_file(url, file)
//imgcache_set_thumb(url, thumb)
function imgcache_set_file(url, file)
{
	var c = get_create_image_cache_by_url(url);
	c.file = file;
	set_image_in_cache(c);
	write_image_cache();
}
function imgcache_set_thumb(url, thumb)
{
	var c = get_create_image_cache_by_url(url);
	c.thumb = thumb;
	set_image_in_cache(c);
	write_image_cache();
}

read_image_cache();
var FULL_IMAGE_DIR = 'imagecache_full';
var SCALE_IMAGE_DIR=  'imagecache_thumb';
try{fs.mkdirSync(FULL_IMAGE_DIR);}catch(e){}
try{fs.mkdirSync(SCALE_IMAGE_DIR);}catch(e){}




var image_caching_queue = [];
var cache_image = function(url)
{
	var mainurl = urlm.parse(url);
	var selector = getselector(mainurl.host);
	if(selector.length > 0 || is_direct_link_to_image(url))
	{
		if(image_caching_queue.indexOf(url) == -1)image_caching_queue.push(url);
	}
}

var demangle_url = function(host_url, url)
{
	if(host_url != url)
	{
		var mainurl = urlm.parse(host_url);
		var url_o = urlm.parse(url);
		if(!url_o.host && !url.startsWith('//'))
		{
			url_o.protocol = mainurl.protocol;
			url_o.host = mainurl.host;
			url = urlm.format(url_o);
		}
	}
	if(url.startsWith('//'))
	{
		if(host_url.startsWith('https'))url = 'https:'+url;
		else url = 'http:'+url;
	}
	return url;
}

var mkheaders = function(url)
{
	var headers = {
	//'Accept-Encoding': '',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
	'content-type': 'application/x-www-form-urlencoded',
	'X-Requested-With': 'XMLHttpRequest',
	'origin': url,
	'referer': url,
	'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
	};
	return headers;
}

function makeid(length) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result.push(characters.charAt(Math.floor(Math.random() * 
 charactersLength)));
   }
   return result.join('');
}
const path = require('path');
function nametruncate(imgname)
{
	var root = path.posix.dirname(imgname);
	var filename = path.posix.basename(imgname);
	
	if(fs.existsSync(imgname))
	{
		console.log('generating random name for overlap');
		var ending = filename.split('.');
		ending = ending[ending.length-1];
		if(ending.length > 7)ending = '.img';
		filename = makeid(40)+'.'+ending;
	}
	
	
	if(filename.length > 48)
	{
		console.log('truncating name');
		var repeat = false;
		do
		{
			repeat = false;
			var new_imgname = filename.substring(1);
			if(!fs.existsSync(new_imgname))
			{
				filename = new_imgname;
				repeat = true;
			}
			
		}while(repeat && filename.length > 48);
	}
	return root+'/'+filename;
}

var cache_image_direct_from_url = function(original_url, url)
{
	var asseturl = demangle_url(original_url, url);//just in case
	
	console.log('caching '+asseturl);
	//var imgname = asseturl.split('/')[asseturl.split('/').length-1].split('?')[0];
	var imgname = smartnamedemangler(asseturl);
	
	var destination = FULL_IMAGE_DIR+'/'+imgname;
	
	destination = nametruncate(destination);
	
	
	//addimagecache(original_url,destination);
	imgcache_set_file(original_url, destination);
						
	if (!fs.existsSync(destination))
	{
		request({url:asseturl,headers:mkheaders(original_url),followRedirect:true,followAllRedirects:true})
		.on('error', function (err) {
			console.log('error on '+asseturl);
			sleep(100);
			setImmediate(cache_image_tick);
		}).pipe(fs.createWriteStream(destination))
		.on('error', function (err) {
			console.log('error '+err);
			sleep(100);
			setImmediate(cache_image_tick);
		}).on('close', function (err) {
			console.log('finished saving '+asseturl+' to '+destination);
			
			sleep(100);
			setImmediate(cache_image_tick);
		});
	}else
	{
		setImmediate(cache_image_tick);
	}
}


function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
var failfail = [];

var sequential_tmr = 0;
var cache_image_tick = function()
{
	console.log('cache_image_tick('+image_caching_queue.length+')');
	if(image_caching_queue.length > 0)
	{
		var url = image_caching_queue.pop();
		console.log('proc '+url);
		if(is_direct_link_to_image(url))
		{
			cache_image_direct_from_url(url,url);
		}else
		{
			var r_url = url;
			if(url.indexOf('deviantart') != -1 && url.indexOf('backend.deviantart') == -1)
			{
				r_url = 'http://backend.deviantart.com/oembed?url='+url;
			}
			if(url.indexOf('artstation.com/artwork/') != -1 && url.indexOf('.json') == -1)
			{
				r_url = url+'.json';
			}
			
			sleep(100);
			var reqo = request({url:r_url,headers:mkheaders(url),followRedirect:true,followAllRedirects:true}, function (error, res, body)
			{
				var waiting = false;
				if (!error && res.statusCode == 200)
				{
					sequential_tmr=0;
					var $ = cheerio.load(body);
					var mainurl = urlm.parse(url);
					var selector = getselector(mainurl.host);
					var img = $('gfdgdfgdfgdfg');
					for(var i =0; i < selector.length; i++)
					{
						img = $(selector[i]).first();
						if(img.length > 0)i=selector.length;
					}
					
					var asseturl = img.attr('src');
					
					//Special casing
					if(img.size() == 0)
					{
						if(url.indexOf('artstation') != -1)
						{
							if(url.indexOf('.json') != -1)
							{
								var json = JSON.parse(body).assets;
								if(json.assets.length > 0 && json.assets[0].has_image)
								{
									asseturl = json.assets[0].image_url;
								}else asseturl='';
							}else
							{
								asseturl = 'https://cdna.artstation.com/'+body.extract('https://cdna.artstation.com/','\\');
							}
						}else if(r_url.indexOf('backend.deviantart') != -1)
						{
							var json = JSON.parse(body);
							asseturl = json.url;
						}else if(url.indexOf('pinterest') != -1)
						{
							asseturl = 'https://i.pinimg.com/originals/' + body.extract('https://i.pinimg.com/originals/','"');
						}else if(url.indexOf('imgur') != -1)
						{
							asseturl = $('link[rel="image_src"]').first().attr('href');
						}else if(url.indexOf('sankakucomplex') != -1 && body.indexOf('This post was deleted') != -1)
						{
							asseturl = $('#parent-preview img').attr('src');
						}else if(url.indexOf('imgur.com') != -1)
						{
							var bit = url.split('.com/')[1];
							asseturl = 'https://i.imgur.com/'+bit+'.png';
						}
					}else if(!asseturl || asseturl.length == 0)//tumblr nonsense
					{
						asseturl = img.attr('srcset').split(' ')[0];
					}
					if(asseturl && asseturl != '')
					{
						asseturl = demangle_url(url, asseturl);
						if(asseturl && asseturl != '')
						{
							waiting=true;
							cache_image_direct_from_url(url, asseturl);
						}
					}else
					{
						console.log('!!FAILED image '+url);
						if(failfail.indexOf(url) == -1)failfail.push(url);
					}
				}else
				{
					
					console.log(error);
					
					console.log(r_url);
					if(res && res.statusCode)console.log(res.statusCode);
					sleep(100);
					if(res && res.statusCode)
					{
						if(res.statusCode == 429 || res.statusCode == 502)
						{
							if(sequential_tmr > 1 || image_caching_queue.length < 100)sleep(10000+(sequential_tmr*2000));
							sequential_tmr += 1;
							
							
						}
						if(res.statusCode != 404 && res.statusCode != 403 && res.statusCode != 400)
						{
							image_caching_queue.push(url);
							if(sequential_tmr != 0)image_caching_queue = shuffle(image_caching_queue);
						}
					}else
					{
						//captcha?
					}
				}
				if(!waiting)setImmediate(cache_image_tick);
			});
		}
	}else
	{
		rebuildqueues();
		image_rescale_tick();
	}
}

var deletions = false;
var iterations = 0;

var image_rescaling_queue = [];
var image_rescale_tick = function()
{
	console.log('image_rescale_tick('+image_rescaling_queue.length+')');
	if(image_rescaling_queue.length > 0)
	{
		var key = image_rescaling_queue.pop();
		var file = imgcache_get_full_file_from_url(key);
		var dest = file.replaceAll(FULL_IMAGE_DIR,SCALE_IMAGE_DIR);
		//console.log('pop');
		dest = nametruncate(dest);
		console.log('will unscaled '+file+' to '+dest);
		if (!fs.existsSync(dest))
		{
			Jimp.read(file, (err, lenna) =>
			{
				if (err)
				{
					console.log(file+' ERR '+err);
					if((err+'').indexOf('Could not find MIME for Buffer <null>') != -1)
					{
						fs.unlinkSync(file);
						imgcache_set_file(key, '');
						//addimagecache(key,'');
						deletions = true;
						//hmmm
					}else
					{
						imgcache_set_thumb(key, dest);
						//addimagecache(key,dest);
						fs.copyFile(file, dest, (err) => {
							 if (err)
							 {
								 console.log('failed copy unscaled '+file);
								 //addimagecache(key,'');
								 imgcache_set_thumb(key, '');
								 //throw err;
							 }else
							 {
								console.log('copied unscaled '+file);
							 }
							 //console.log('source.txt was copied to destination.txt');
						});
					}
				}else
				{
					imgcache_set_thumb(key, dest);
					//addimagecache(key,dest);
					lenna.resize(325, Jimp.AUTO) // resize
					.quality(90) // set JPEG quality
					.write(dest); // save
					console.log('saved rescaled '+file);
				}
				setImmediate(image_rescale_tick);
			});
		}else
		{
			console.log('rescaled already present '+dest);
			imgcache_set_thumb(key, dest);
			//addimagecache(key,dest);
			setImmediate(image_rescale_tick);
		}
	}else
	{
		if(deletions && iterations < 5)
		{
			deletions = false;
			iterations += 1;
			rebuildqueues();
			cache_image_tick();
		}else
		{
			console.log('IMAGE COLLATION COMPLETE.');
			
			for(var i = 0; i < failfail.length; i++)
			{
				console.log('failed: '+failfail[i]);
			}
		}
	}
}




var rebuildqueues = function()
{
	image_caching_queue = [];
	image_rescaling_queue = [];
	for(var i = 0; i < IMAGE_CACHE_V3.length; i++)
	{
		var c1 = IMAGE_CACHE_V3[i];
		if(c1.url != '')
		{
			if(c1.file == '')image_caching_queue.push(c1.url);
			else if(c1.thumb == '')image_rescaling_queue.push(c1.url);
		}
	}
	console.log('caching queue='+image_caching_queue.length);
	console.log('rescale queue='+image_rescaling_queue.length);
	
	/*for (var key in IMAGE_CACHE_JSON)
	{
		if (Object.prototype.hasOwnProperty.call(IMAGE_CACHE_JSON, key))
		{
			if(IMAGE_CACHE_JSON[key] == '')
			{
				console.log('mkcaching '+key);
				cache_image(key);
			}else if(IMAGE_CACHE_JSON[key].indexOf(FULL_IMAGE_DIR) != -1)
			{
				image_rescaling_queue.push(key);
			}
		}
	}*/
}



rebuildqueues();
image_caching_queue = shuffle(image_caching_queue);
setImmediate(image_rescale_tick);
//image_rescale_tick();

//cache_image_tick();

