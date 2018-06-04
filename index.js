/** 引入相关依赖
 */
const { get } = require('https');
const URL = require('url');
const del = require('del');
const makeDir = require('make-dir');
const argv = require('yargs').argv
const {
  appendFileSync: fsAppendFileSync,
  readFile: fsReadFile,
  writeFile: fsWriteFile,
  writeFileSync: fsWriteFileSync
} = require('fs');
const { Transform: stream } = require('stream');

/** 从输入接受关键词 */
let searchType = 'all';
let keyword =  encodeURIComponent(argv.keyword || '崩坏3');
let decodeKeyword = decodeURIComponent(keyword);
let tmpFileName  = 'tmp.json';
let filefolder = './imgs/';
let totalPage = 0;
let currentPage = 1;
let currentPagesize = 20;
let downloadList = [];

/** 按页面下载函数 */
function downloadByPage(type, page) {
  let rqOption = {
    host: 'search.bilibili.com',
    path: `/api/search?search_type=${type}&keyword=${keyword}&page=${page}`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36'
    }
  };
  return new Promise((dresolve, dreject) => {
    console.log('-------------- 开始下载' + page + '页');
    /** 请求前,清空文件,创建保存文件夹 */
    del([tmpFileName])
    .then(val => {
      /** 发起请求,解析返回数据 */
      get(rqOption, rqRes => {
        let {
          statusCode,
          statusMessage
        } = rqRes;
        if(statusCode != 200) return console.error('请求失败!\n', statusCode, statusMessage);
        
        let rewdata = '';        
        // 写出数据到内存中
        rqRes.on('data', data => {
          rewdata += data;
        });
        // 读取数据结束,开始发起请求并下载图片流程
        rqRes.on('end', data => {
          // 读取数据并分析
          let picArray = [];
          let downloadArr = [];
          // 同步写数据
          fsAppendFileSync(tmpFileName, rewdata, {
            encoding: 'utf8'
          });
          fsReadFile(tmpFileName, {
            encoding: 'utf8'
          }, (err, data) => {
            data = JSON.parse(data);
            let {
              numPages,
              page,
              pagesize,
              result: {
                video: rsVideo
              }
            } = data;
            totalPage = numPages;
            currentPage = page;
            // currentPagesize = pagesize;
            currentPagesize = pagesize = 20;
            for(let key in rsVideo) {
              let { pic } = rsVideo[key];
              picArray.push(pic);
            }
            if(!picArray.length) return console.error('关键词' + decodeKeyword + '搜索结果为空!');
            // 使用链接下载图片
            let downloadPageList = picArray.reduce((init, current, idx) => {
              return init
                .then(res => {
                  let index = (currentPage - 1) * pagesize + (idx + 1);
                  return downloadImage([current, index]);
                });
            }, Promise.resolve());
            // 下载当前页面完毕
            downloadPageList.then(val => {
              console.log('-------------- 下载完成' + currentPage + '页');
              dresolve(currentPage + 1);
            });
          });
        });
      });
    })
    .catch(err => {
      dreject();
      console.error(err);
    });
  });
}

/** 下载指定图片
 *  @url [string] 图片URL
 *  @return [promise] 下载图片promise
 */
function downloadImage(args = ['', 1]) {
  let url = args[0];
  return new Promise((resolve, reject) => {
    let imgName = /[^/]+\.(jpg|png|gif|jpeg)/igm.exec(url);
    imgName = decodeKeyword + '-' + args[1] + '.' + imgName[1];
    get('https:' + url, res => {
      let data = new stream();
      res.on('data', chunk => {
        data.push(chunk);
      });
      res.on('end', () => {
        // 存在文件夹则创建文件夹
        fsWriteFileSync(filefolder + imgName, data.read());
        console.log(imgName, '下载完成!');
        resolve('');
      });
    });
  });
}

// 开始下载
del([filefolder, tmpFileName])
/** 创建临时文件和文件夹 */
.then(val => {
  return makeDir(filefolder);
})
.then(() => {
  return downloadByPage(searchType, 1)
})
.then(() => {
  let downloadList = Array.apply(null, Array(totalPage - 1)).map(function(item, i) {
      return i + 2;
  });
  return downloadList.reduce((init, current, idx) => {
    return init
      .then((page = 2) => {
        return downloadByPage(searchType, page);
      });
    }, Promise.resolve());
});