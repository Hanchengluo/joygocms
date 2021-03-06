﻿var houses = require('../../models/houses').houses;
var Regions = require('../../models/regions').regions;
var Anchors = require('../../models/anchors').anchors;
var Anchorsdynamics = require('../../models/anchorsdynamics').anchorsdynamics;
var Questions = require('../../models/questions').questions;
var Answers = require('../../models/answers').answers;
var Alysjobs = require('../../models/alys').alysjobs;
var Qandas = require('../../models/qandas').qandas;
var Counters = require('../../models/counters').counters;
var Postsalbums = require('../../models/postsalbums').postsalbums;
var Cooper = require('../../models/cooperation').cooperation;
var Sysconfigs=require('../../models/sysconfigs').sysconfigs;
var Regs = require('../../models/regs').regs;
var Awards = require('../../models/regs').awards;
var Ranking = require('../../models/regs').ranking;
var moment = require('moment');
var response = require('../../lib/response');
var comm = require('../../lib/comm');
var config = require('../../config');
var validator = require('validator');
var cache = require('../../lib/cache');
var url = require('url');
var path = require('path');
var ALY = require('../../lib/aly/util');
var request = require('request');
var fs = require("fs");
var formidable = require('formidable');
var _ = require('lodash');
var eventproxy = require('eventproxy');
var _const={
    'get_posts_albums':config.session_secret+'get_posts_albums_'+config.version,
}
//获取房产信息
exports.get_houses = function(req, res) {
  var mpno = comm.get_req_string(req.query.mpno, '');
  var provincecode = comm.get_req_string(req.query.provincecode, '');
  var citycode = comm.get_req_string(req.query.citycode, '');
  var streetcode = comm.get_req_string(req.query.streetcode, '');
  var priceregions = comm.get_req_string(req.query.priceregions, '');
  var room = comm.get_req_int(req.query.room, -1);
  var title = comm.get_req_string(req.query.title, '');
  var options = comm.api_get_page_options(req);
  var query = houses.find();
  if (mpno !== '') query.and({
    mpno: mpno
  });
  if (provincecode !== '') query.and({
    provincecode: provincecode
  });
  if (citycode !== '') query.and({
    citycode: citycode
  });
  if (streetcode !== '') query.and({
    streetcode: streetcode
  });
  if (priceregions !== '') query.and({
    priceregions: priceregions
  });
  if (room !== -1) query.and({
    room: room
  });
  if (title !== '') query.and({
    title: eval("/" + title + "/")
  });
  var select = {
    __v: 0,
    citycode: 0,
    streetcode: 0,
    provincecode: 0,
    status: 0,
    expire: 0,
    priceregions: 0
  };
  query.skip(options.skip).limit(options.limit).sort("-createtime").select(select)
    .exec(function(err, models) {
    if (err) {
      return res.send({
        "code": 0
      });
    }
    models.forEach(function(node, index) {
      node = node.toObject();
      node.createtime = parseInt(moment(node.createtime).format('X'));
      node.pics = comm.replace_pics(node.pics);
      node.slides.forEach(function(item, i) {
        item.pics = comm.replace_pics(item.pics);
        node.slides[index] = item;
      })
      models[index] = node;
    })
    return response.api(res, {}, models);

  })
}
exports.get_houses_detail = function(req, res) {
  var select = {
    __v: 0,
    citycode: 0,
    streetcode: 0,
    provincecode: 0,
    status: 0,
    expire: 0,
    priceregions: 0
  };
  houses.findOne({
    _id: req.query._id
  }).select(select).exec(function(err, model) {
    if (err || !model) {
      return res.send({
        code: 0
      });
    }
    return response.apidetail(res, {}, model);
  })
}
var regions = function(callback) {
  Regions.find().exec(function(err, models) {
    callback(err, models);
  });
}
  //获取区域信息
exports.get_houses_regions = function(req, res) {
  var proxy = new eventproxy();
  proxy.all('list', function(list) {
    return res.send({
      code: 1,
      list: list
    });
  })
  regions(proxy.done(function(models) {
    proxy.emit('list', models);
  }))
}

exports.get_houses_config = function(req, res) {
  return res.send({
    code: 1,
    priceregions: [{
      key: "1",
      val: "60万以下",
    }, {
      key: "2",
      val: "60万-80万",
    }, {
      key: "3",
      val: "80万-100万",
    }, {
      key: "4",
      val: "100万-150万",
    }, {
      key: "5",
      val: "150万-200万",
    }, {
      key: "6",
      val: "200万以上",
    }],
    rooms: [{
      key: "1",
      val: "一室",
    }, {
      key: "2",
      val: "二室",
    }, {
      key: "3",
      val: "三室",
    }, {
      key: "4",
      val: "四室",
    }, {
      key: "5",
      val: "五室",
    }, {
      key: "100",
      val: "五室以上",
    }]
  });
}
exports.set_houses = function(req, res) {
  // parse a file upload
  //存放目录
  var dir = moment().format("YYYY-MM-DD");
  var form = new formidable.IncomingForm({
      maxFieldsSize: 50 * 1024 * 1024, // 最大申请到50m内存
      keepExtensions: true,
      maxFields: 10,
      multiples: true,
      uploadDir: './public/upload/houses/' + dir
    }),
    files = [],
    fields = [],
    docs = [];
  if (fs.existsSync(form.uploadDir)) {
    console.log('已经创建过此目录了');
  } else {
    fs.mkdirSync(form.uploadDir);
    console.log('目录已创建成功\n');
  }
  form.on('file', function(field, file) {
    file.path = path.join('/upload/houses', dir, path.basename(file.path));
    file.path = file.path.replace(/\\/ig, '/');
    if (file.size > 0) {
      docs.push({
        pics: file.path,
        name: file.name
      });
    }
  }).parse(req, function(error, fields, files) {
    var mpno = comm.get_req_string(_.get(fields, 'mpno'), '');
    if (!validator.trim(mpno)) {
      return res.send({
        "code": 0,
        message: "用户id是必填项"
      });
    }
    var title = comm.get_req_string(_.get(fields, 'title'), '');
    if (!validator.trim(title)) {
      return res.send({
        "code": 0,
        message: "标题是必填项"
      });
    }
    var linkman = comm.get_req_string(_.get(fields, 'linkman'), '');
    if (!validator.trim(linkman)) {
      return res.send({
        "code": 0,
        message: "联系人是必填项"
      });
    }
    var linkphone = comm.get_req_string(_.get(fields, 'linkphone'), '');
    if (!validator.trim(linkphone)) {
      return res.send({
        "code": 0,
        message: "电话是必填项"
      });
    }
    var acreage = comm.get_req_int(_.get(fields, 'acreage'), 0);
    if (!validator.isInt(acreage, {
        min: 1
      })) {
      return res.send({
        "code": 0,
        message: "面积是必填项"
      });
    }
    var price = comm.get_req_int(_.get(fields, 'price'), 0);
    if (!validator.isInt(price, {
        min: 1
      })) {
      return res.send({
        "code": 0,
        message: "价格是必填项"
      });
    }
    var provincecode = comm.get_req_string(_.get(fields, 'provincecode'), '');
    var citycode = comm.get_req_string(_.get(fields, 'citycode'), '');
    var streetcode = comm.get_req_string(_.get(fields, 'streetcode'), '');
    if (!validator.trim(provincecode)) {
      return res.send({
        "code": 0,
        message: "区域是必填项"
      });
    }
    var proxy = new eventproxy();
    proxy.all('list', function(list) {
      var model = new houses({
        mpno: mpno,
        title: title,
        provincecode: provincecode,
        citycode: citycode,
        streetcode: streetcode,
        province: comm.get_req_string(_.result(_.find(list, function(chr) {
          return chr._id == provincecode;
        }), 'name'), ''),
        city: comm.get_req_string(_.result(_.find(list, function(chr) {
          return chr._id == citycode;
        }), 'name'), ''),
        street: comm.get_req_string(_.result(_.find(list, function(chr) {
          return chr._id == streetcode;
        }), 'name'), ''),
        desc: comm.get_req_string(_.get(fields, 'desc'), ''),
        linkman: linkman,
        linkphone: linkphone,
        price: price,
        slides: docs,
        acreage: acreage,
        address: comm.get_req_string(_.get(fields, 'address'), ''),
        room: comm.get_req_int(_.get(fields, 'room'), 0),
        hall: comm.get_req_int(_.get(fields, 'hall'), 0),
        wei: comm.get_req_int(_.get(fields, 'wei'), 0),
      });
      if (docs.length > 0) {
        model.pics = docs[0].pics;
      }
      if (price <= 60) {
        model.priceregions = 1;
      } else if (price > 60 && price <= 80) {
        model.priceregions = 2;
      } else if (price > 80 && price <= 100) {
        model.priceregions = 3;
        _.get(fields, 'provincecode')
      } else if (price > 100 && price <= 150) {
        model.priceregions = 4;
      } else if (price > 150 && price <= 200) {
        model.priceregions = 5;
      } else {
        model.priceregions = 6;
      }
      model.save(function(err) {
        if (!err) {
          return res.send({
            code: 1
          });
          x
        } else {
          return res.send({
            code: 0
          });
        }
      })
    })
    regions(proxy.done(function(models) {
      proxy.emit('list', models);
    }))

  });
}
//培训报名
exports.set_regs=function(req,res){
  var name =comm.get_req_string(req.body.name,'');
  if (name=='')return res.send({ "code": 0 ,message:'name is not empty!'});
  var dir='/upload/'+moment().format('YYYY-MM-DD');
  var regs=new Regs({
    sex :comm.get_req_string(req.body.sex,''),
    birthday:comm.get_req_string(req.body.birthday,''),
    place:comm.get_req_string(req.body.place,''),
    nation:comm.get_req_string(req.body.nation,''),
    edu:comm.get_req_string(req.body.edu,''),
    idnumber:comm.get_req_string(req.body.idnumber,''),
    phone:comm.get_req_string(req.body.phone,''),
    address:comm.get_req_string(req.body.address,''),
    resume:comm.get_req_string(req.body.resume,''),
    mark:comm.get_req_string(req.body.mark,''),
    group:comm.get_req_string(req.body.group,''),//成人班(18~30周岁) ，青少年班(6~17周岁)
    name:name,
    mpno:comm.get_req_string(req.body.mpno,''),
    code:comm.get_req_int(req.body.code,0),
    pics:req.body.pics?comm.base64_decode({
        base64str:req.body.pics,
        absolutelydir:'./public'+dir,
        relativedir:dir,
      }):'',
    height:comm.get_req_string(req.body.height,''),//身高
    occupation:comm.get_req_string(req.body.occupation,''),//职业
    specialty:comm.get_req_string(req.body.specialty,''),//特长
    school:comm.get_req_string(req.body.school,''),//毕业院校
  })
  regs.save(function(err){
    if(err)return res.send({cod:0,message:'save error！'});
    else{
      return res.send({code:1,message:"success"});
    }
  })
}
  //获取主播秀
exports.get_anchors = function(req, res) {
  var options = comm.api_get_page_options(req);
  var where = {
    status: 0
  };
  var query = Anchors.find(); //只能正常的主播
  var select = {
    slides: 0,
    __v: 0,
    content: 0,
    status: 0
  };
  query.skip(options.skip).limit(options.limit).sort("-createtime").select(select)
  .exec(function(err, models) {
    if (err) {
      return res.send({"code": 0});
    }
    models.forEach(function(node, index) {
      node = node.toObject();
      node.createtime = parseInt(moment(node.createtime).format('X'));
      node.lasttime = parseInt(moment(node.lasttime).format('X'));
      node.pics = comm.replace_pics(node.pics);
      node.background = comm.replace_pics(node.background);
      node.face = comm.replace_pics(node.face);
      models[index] = node;
    })
    return response.api(res, {}, models);
  })
}
//写入主播 图片
exports.set_anchors_img = function(req, res) {
  // parse a file upload
  var dir = moment().format("YYYY-MM-DD");
  var form = new formidable.IncomingForm({
      maxFieldsSize: 50 * 1024 * 1024, // 最大申请到50m内存
      keepExtensions: true,
      maxFields: 10,
      multiples: true,
      uploadDir: './public/upload/' + dir
    }),
    files = [],
    fields = [],
    docs = [];
  if (!fs.existsSync(form.uploadDir)) {
    fs.mkdirSync(form.uploadDir);
    console.log('目录已创建成功\n');
  }
  form.on('error', function(err) {
    console.log(err); //各种错误
  }).on('file', function(field, file) {
    file.path = path.join('/upload', dir, path.basename(file.path));
    file.path = file.path.replace(/\\/ig, '/');
    if (file.size > 0) {
      docs.push({
        pics: file.path,
        type: 1 //1=图片2=视频
      });
    }
  }).parse(req, function(error, fields, files) {
    var anchorsid = validator.trim(_.get(fields, 'anchorsid'));
    var key=validator.trim(_.get(fields, 'key'));
    if (anchorsid === '') {
      return res.redirect('/html5/page/anchor/anchor_setting.html?code=0&message=anchorsid不能为空');
    }
    var anchors = {};
    if(key==='face')anchors.face=docs[0].pics;
    if(key==='background')anchors.background=docs[0].pics;
    Anchors.findOneAndUpdate({_id: anchorsid},anchors , function(err) {
      if (err) {
        return res.redirect('/html5/page/anchor/anchor_setting.html?code=0');
      } else {
        return res.redirect('/html5/page/anchor/anchor_setting.html?code=1');
      }
    })
  });
}
//写入主播 文字
exports.set_anchors_text = function(req, res) {
  var anchorsid = validator.trim(req.body.anchorsid);
  var key=validator.trim(req.body.key);
  var value=validator.trim(req.body.value);
  if (anchorsid === '') {
    return res.redirect('/html5/page/anchor/anchors_update_redirect.html?code=0&message=anchorsid不能为空');
    return res.send({code:0,message:'anchorsid不能为空'});
  }
  var anchors = {};
  if(key==='signature')anchors.signature=value;
  if(key==='aword')anchors.aword=value;
  if(key==='content')anchors.content=value;
  if(key==='name')anchors.name=value;
  console.log(anchors);
  Anchors.findOneAndUpdate({_id: anchorsid},anchors , function(err) {
    if (err) {
      return res.send({code:0});
    } else {
      return res.send({code:1});
    }
  })
}
  //获取主播秀详情
exports.get_anchors_detail = function(req, res) {
  var mpno=validator.trim(req.query.mpno);
  var select = {
    __v: 0,
    _id: 0,
    status: 0
  };
  Anchors.findOne({
    _id: validator.trim(req.query._id)
  }).select(select).exec(function(err, model) {
    if (err || !model) {
      return res.send({
        code: 0
      });
    }
    model = model.toObject();
    model.createtime = parseInt(moment(model.createtime).format('X'));
    model.lasttime = parseInt(moment(model.lasttime).format('X'));
    model.pics = comm.replace_pics(model.pics);
    model.face = comm.replace_pics(model.face);
    model.slides.forEach(function(item, i) {
      item.pics = comm.replace_pics(item.pics);
      model.slides[i] = item;
    });
    model.user_like_this_post.forEach(function(item, i) {
      if(item.mpno == mpno){
        model.assisted=1
      }else{
        model.assisted=0
      }
    });
    return response.apidetail(res, {}, model);
  })
}
  //获取主播秀动态
exports.get_anchors_dynamics = function(req, res) {
    var anchorsid = validator.trim(req.query.anchorsid); //获取主播id
    var query = Anchorsdynamics.find({
      status: 0
    }); //只能正常的主播动态
    var options = comm.api_get_page_options(req);
    if (anchorsid) {
      query.and({
        anchorsid: anchorsid
      });
    }
    var select = {
      status: 0,
      __v: 0,
      user_like_this_post:0
    };
    query.populate('anchorsid','name -_id face',null).skip(options.skip).limit(options.limit).sort("-createtime").select(select)
      .exec(function(err, models) {
        if (err) {
          return res.send({"code": 0,message: '出错了'});
        } else {
          models.forEach(function(node, index) {
            node = node.toObject();
            node.createtime = parseInt(moment(node.createtime).format('X'));
            node.face = comm.replace_pics(node.anchorsid.face);
            node.name = node.anchorsid.name;
            node.slides.forEach(function(item, i) {
              item.pics = comm.replace_pics(item.pics);
              node.slides[i] = item;
            })
            delete node.anchorsid;
            models[index] = node;
          })
          return response.api(res, {}, models);
        }
      })
}
//获取主播动态详情
exports.get_anchors_dynamics_detail=function(req,res){
  var select = {
    __v: 0,
    _id: 0,
    status: 0,
  };
  var mpno=validator.trim(req.query.mpno);

  Anchorsdynamics.findOne({
    _id: validator.trim(req.query._id)
  }).populate('anchorsid','name -_id face',null).select(select).exec(function(err, model) {
    if (err || !model) {
      return res.send({code: 0});
    }
    model = model.toObject();
    model.assisted = 0;
    if (model.user_like_this_post instanceof Array) {
        model.user_like_this_post.forEach(function (item, i) {
            if ( mpno=== item.mpno) {
                model.assisted = 1;
                return
            }
        });
    }
    delete model.user_like_this_post;
    model.createtime = parseInt(moment(model.createtime).format('X'));
    model.face = comm.replace_pics(model.anchorsid.face);
    model.name = model.anchorsid.name;
    delete model.anchorsid;
    model.slides.forEach(function(item, i) {
      item.pics = comm.replace_pics(item.pics);
      model.slides[i] = item;
    })
    return response.apidetail(res, {}, model);
  })
}
//写入主播动态
exports.set_anchors_dynamics = function(req, res) {
  // parse a file upload
  var dir = moment().format("YYYY-MM-DD");
  var form = new formidable.IncomingForm({
      maxFieldsSize: 50 * 1024 * 1024, // 最大申请到50m内存
      keepExtensions: true,
      maxFields: 10,
      multiples: true,
      uploadDir: './public/upload/q&a/' + dir
    }),
    files = [],
    fields = [],
    docs = [];
  if (!fs.existsSync(form.uploadDir)) {
    fs.mkdirSync(form.uploadDir);
    console.log('目录已创建成功\n');
  }
  form.on('error', function(err) {
    console.log(err); //各种错误
  }).on('file', function(field, file) {
    file.path = path.join('/upload/q&a', dir, path.basename(file.path));
    file.path = file.path.replace(/\\/ig, '/');
    if (file.size > 0) {
      docs.push({
        pics: file.path,
        type: 1 //1=图片2=视频
      });
    }
  }).parse(req, function(error, fields, files) {
    var anchorsid = validator.trim(_.get(fields, 'anchorsid'));
    var mpno = validator.trim(_.get(fields, 'mpno'));
    var name = validator.trim(_.get(fields, 'name'));
    if (anchorsid === '') {
      return res.redirect('/html5/page/anchor/write_dynamic.html?code=0&message=anchorsid不能为空');
      //return res.send({code:0});
    }
    var anchorsdynamics = new Anchorsdynamics({
      content: validator.trim(_.get(fields, 'content')),
      face: validator.trim(_.get(fields, 'face')),
      anchorsid: anchorsid,
      slides: docs,
      status: 0,
      assistcount: 0,
      commentcount: 0
    });
    anchorsdynamics.save(function(err) {
      if (err) {
        return res.redirect('/html5/page/anchor/write_dynamic.html?code=0');
      } else {
        //写入动态数
        Anchors.findOneAndUpdate({_id: anchorsid}, {$inc: { "dynamiccount": 1}}, function(err) {
          if (err) {
            return res.redirect('/html5/page/anchor/write_dynamic.html?code=0');
          } else {
            return res.redirect('/html5/page/anchor/anchor_detail.html?code=1&id='+anchorsid+'&mpno='+mpno+'&name'+name);
          }
        })
      }
    });
  });
}
exports.set_anchors_dynamics_assist=function(req,res){

}
//获取提问|获取我的提问|获取向我提问的
exports.get_questions = function(req, res) {
  var publishmpno = validator.trim(req.query.publishmpno); //获取提问用户
  var answermpno = validator.trim(req.query.answermpno); //获取被问用户
  var sort = comm.get_req_int(req.query.sort, -1); //获取被问用户
  var isanswered = comm.get_req_int(req.query.isanswered, -1); //获取被问用户
  var content=validator.trim(req.query.content)
  var options = comm.api_get_page_options(req);
  var query = Questions.find();
  if (publishmpno != '') query.and({
    publishmpno: publishmpno
  });
  if (answermpno != '') query.and({
    answermpno: answermpno
  });
  if (isanswered != '-1') query.and({
    isanswered: isanswered
  });
  if (content != '') query.and({
    content:eval("/"+content+"/")
  });
  query.and({status:0});
  query.skip(options.skip).limit(options.limit).sort({
    createtime: sort
  }).exec(function(err, models) {
    if (err) {
      return res.send({
        "code": 0
      });
    }
    models.forEach(function(node, index) {
      node = node.toObject();
      node.createtime = parseInt(moment(node.createtime).format('X'));
      node.lasttime = parseInt(moment(node.lasttime).format('X'));
      node.files.forEach(function(item, i) {
        item.pics = comm.replace_pics(item.pics);
        item.url = comm.replace_pics(item.url);
        node.files[i] = item;
      })

      node.publishuserface = comm.replace_pics(node.publishuserface);
      node.answeruserface = comm.replace_pics(node.answeruserface);
      models[index] = node;
    })
    return response.api(res, {}, models);
  })
}
//获取问答明细
exports.get_questions_detail = function(req, res) {
  var questionid = validator.trim(req.query.questionid); //获取提问编号
  if (questionid === '') {
    return res.send({
      code: 0
    });
  }
  Questions.findOne({
    _id: questionid
  }).select({
    __v: 0,
    status: 0,
    isanswered: 0
  }).exec(function(err, model) {
    if (err || !model) return res.send({code: 0});
    node = model.toObject();
    node.createtime = parseInt(moment(node.createtime).format('X'));
    node.lasttime = parseInt(moment(node.lasttime).format('X'));
    node.files.forEach(function(item, i) {
      item.pics = comm.replace_pics(item.pics);
      item.url = comm.replace_pics(item.url);
      node.files[i] = item;
    })
    node.publishuserface = comm.replace_pics(node.publishuserface);
    node.answeruserface = comm.replace_pics(node.answeruserface);
    model = node;
    return response.apidetail(res, {}, model);
  })
}
//获取回答
exports.get_answers = function(req, res) {
  var questionid = validator.trim(req.query.questionid); //获取提问编号,多个","分割
  var mpno = validator.trim(req.query.mpno); //当前用户mpno
  var options = comm.api_get_page_options(req);
  if (questionid === '') {
    return res.send({
      "code": 0
    });
  }
  var query = Answers.find({questionid: questionid});
  query.skip(options.skip).limit(options.limit).sort("-createtime")
  .exec(function(err, models) {
    if (err) {
      return res.send({
        "code": 0
      });
    }
    models.forEach(function(node, index) {
      node = node.toObject();
      node.createtime = parseInt(moment(node.createtime).format('X'));
      node.files.forEach(function(item, i) {
        item.pics = comm.replace_pics(item.pics);
        item.url = comm.replace_pics(item.url);
        node.files[i] = item;
      })
      node.assisted = 0;
      if (node.user_like_this_post instanceof Array) {
        node.user_like_this_post.forEach(function (item, i) {
          if ( mpno== item.mpno) {
              node.assisted = 1;
              return
          }
        });
      }
      node.answeruserface = comm.replace_pics(node.answeruserface);
      models[index] = node;
    })
    return response.api(res, {}, models);
  })
}
//获取我回答的问题
exports.get_myanswerquestions = function(req, res) {
  var answermpno = validator.trim(req.query.answermpno); //获取回答用户
  var options = comm.api_get_page_options(req);
  if (answermpno === '') {
    return res.send({
      "code": 0
    });
  }
  Qandas.find({
    answermpno: answermpno
  }).populate('questionid').select({
    _id: 0,
    __v: 0,
    createtime: 0
  }).exec(function(err, models) {
    if (err) {
      return res.send({
        "code": 0
      });
    } else {
      var items = [];
      models.forEach(function(node, index) {
        if (node.questionid) {
          node = node.toObject();
          node.questionid.createtime = parseInt(moment(node.questionid.createtime).format('X'));
          node.questionid.lasttime = parseInt(moment(node.questionid.lasttime).format('X'));
          delete node.questionid.__v;
          node.questionid.files.forEach(function(item, i) {
            item.pics = comm.replace_pics(item.pics);
            item.url = comm.replace_pics(item.url);
            node.questionid.files[i] = item;
          })
          node.questionid.publishuserface = comm.replace_pics(node.questionid.publishuserface);
          node.questionid.answeruserface = comm.replace_pics(node.questionid.answeruserface);
          items.push(node);
        }
      })
      return response.api(res, {}, items);
    }
  });
}
//写入提问
exports.set_questions = function(req, res) {
  var dir = moment().format("YYYY-MM-DD");
  var form = new formidable.IncomingForm({
      maxFieldsSize: 50 * 1024 * 1024, // 最大申请到50m内存
      keepExtensions: true,
      maxFields: 10,
      multiples: true,
      uploadDir: './public/upload/q&a/' + dir
    }),
    files = [],
    fields = [],
    docs = [];
  if (fs.existsSync(form.uploadDir)) {
    console.log('已经创建过此目录了');
  } else {
    fs.mkdirSync(form.uploadDir);
    console.log('目录已创建成功\n');
  }
  form.on('file', function(field, file) {
    file.path = path.join('/upload/q&a', dir, path.basename(file.path));
    file.path = file.path.replace(/\\/ig, '/');
    if (file.size > 0) {
      docs.push({
        pics: file.path,
        url: file.path,
        type: 1 //1=图片2=视频
      });
    }
  }).parse(req, function(error, fields, files) {
    var error = '/html5/page/anchor/question_redirect.html?code=0';
    var success = '/html5/page/anchor/question_redirect.html?code=1';
    var publishmpno = validator.trim(_.get(fields, 'publishmpno'));
    if (publishmpno === '') {
      return res.redirect(error);
    }
    var questions = new Questions({
      content: validator.trim(_.get(fields, 'content')),
      publishmpno: validator.trim(_.get(fields, 'publishmpno')),
      publishusername: validator.trim(_.get(fields, 'publishusername')),
      publishuserface: validator.trim(_.get(fields, 'publishuserface')),
      questiontype:validator.trim(_.get(fields, 'questiontype')),
      answermpno: validator.trim(_.get(fields, 'answermpno')),
      answerusername: validator.trim(_.get(fields, 'answerusername')),
      answeruserface: validator.trim(_.get(fields, 'answeruserface')),
      answercontent: validator.trim(_.get(fields, 'answercontent')),
      files: docs,
      status: 0,
    });
    questions.save(function(err) {
      if (err) {
        return res.redirect(error);
      } else {
        var result = "";
        //写入主播提问数
        Anchors.findOneAndUpdate({mpno: publishmpno}, {$inc: {"questionscount": 1}}, function(err) {
          if (err) {
            return res.redirect(error);
          } else {
            //写入主播被问数
            Anchors.findOneAndUpdate({mpno: publishmpno}, {$inc: {"askedcount": 1}}, function(err) {
              if (err) {
                return res.redirect(error);
              } else {
                return res.redirect(success);
              }
            })
          }
        })
      }
    });
  });
}
//写入回答
exports.set_answers = function(req, res) {
  var dir = moment().format("YYYY-MM-DD");
  var form = new formidable.IncomingForm({
      maxFieldsSize: 50 * 1024 * 1024, // 最大申请到50m内存
      keepExtensions: true,
      maxFields: 10,
      multiples: true,
      uploadDir: './public/upload/q&a/' + dir
    }),
    files = [],
    fields = [],
    docs = [];
  if (fs.existsSync(form.uploadDir)) {
    console.log('已经创建过此目录了');
  } else {
    fs.mkdirSync(form.uploadDir);
    console.log('目录已创建成功\n');
  }

  form.on('file', function(field, file) {
    file.path = path.join('/upload/q&a', dir, path.basename(file.path));
    file.path = file.path.replace(/\\/ig, '/');
    if (file.size > 0) {
      docs.push({
        pics: file.path,
        url: file.path,
        type: 1 //1=图片2=视频
      });
    }
  }).parse(req, function(error, fields, files) {
    var questionid = validator.trim(_.get(fields, 'questionid'));
    var answermpno = validator.trim(_.get(fields, 'answermpno'));
    if (questionid === '' || answermpno === '') {
      return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
    }
    var answers = new Answers({
      questionid: validator.trim(_.get(fields, 'questionid')), //问题id
      content: validator.trim(_.get(fields, 'content')), //回答内容
      answermpno: validator.trim(_.get(fields, 'answermpno')), //回答问题的id
      answerusername: validator.trim(_.get(fields, 'answerusername')), //回答问题的人名
      answeruserface: validator.trim(_.get(fields, 'answeruserface')), //回答问题的人头像
      isanchors: validator.trim(_.get(fields, 'isanchors')), //回答人是不是主播
      files: docs //回答问题人传的图片
    });
    console.log(answers);
    answers.save(function(err) {
      if (err) {
        return res.send({"code": 0});
      } else {
        //写入我我回答过的问题，用于获取我回答的问题
        Qandas.count({
          questionid: answers.questionid,
          answermpno: answers.answermpno
        }, function(err, count) {
          if (err) {
            return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
          };
          if (count === 0) {
            var qandas = new Qandas({
              questionid: answers.questionid,
              answermpno: answers.answermpno
            });
            qandas.save(function(err) {
              if (err) {
                return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
              }
            })
          }
        });
        Answers.distinct('answermpno', {questionid:answers.questionid}, function(err,models){
          if(err)return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
          var answercount=models.length+1;
          Questions.findOne({ _id: answers.questionid }, function(err,model){
            if(err || !model)return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
            model.isanswered=1;
            model.lasttime=moment();
            model.answercount=answercount;
            model.answerrecordcount=model.answerrecordcount+1
            if(model.answermpno===answers.answermpno){
                model.answercontent=answers.content
            }
            model.save(function(err){
              if(err)return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
            })
          })
        });
        Anchors.findOneAndUpdate({mpno: answers.answermpno}, {$inc: {"answercount": 1}}, function(err) {
          if (err)return res.redirect('/html5/page/anchor/answer_redirect.html?code=0');
        })
        return res.redirect('/html5/page/anchor/answer_redirect.html?code=1');
      }
    });
  });
}
exports.set_posts_albums=function(req,res){
  var mpno=validator.trim(req.body.mpno);//用户id
  var nickname=validator.trim(req.body.nickname);
  var mid=validator.trim(req.body.mid);//活动id
  var file=validator.trim(req.body.file);
  var bucket=validator.trim(req.body.bucket);
  var type=validator.trim(req.body.type);
  if (!mpno || !mid)return res.send({ "code": 0,message:'Parameter is not empty!' });
  var dir=file.split('/')[0]+"_outfiles/";
  var filename=file.split('/')[1].replace(".","");
  var params={inputfile:file,outfile:dir+filename+".jpg"};
  var url=dir+filename+".mp4";
  //var dir='/upload/'+moment().format('YYYY-MM-DD');
  Sysconfigs.findOne({type:'blacklist',key:'blacklist'},function(err,sysconfigs){
    if(sysconfigs){
      if(sysconfigs.val.indexOf(mpno)>-1)return res.send({ "code": 0,message:'黑名单用户'});
    }
    var proxy = new eventproxy();
    proxy.all('seq','pics',function(seq,pics){
      var postsalbums=new Postsalbums({
        mid:mid,
        user:{
          mpno:mpno,
          nickname:nickname
        },
        pics:pics,
        type:type,
        from:4,
        no:seq,
        name:validator.trim(req.body.name),
        desc:validator.trim(req.body.desc),
      });
      if(type==="0"){
        postsalbums.video={
          url:ALY.oss+url,
          originalurl:file,
          bucket:bucket
        },
        postsalbums.status=3;
      }else{
        postsalbums.status=-1;
      }
      postsalbums.save(function(err){
        if(err){
          return res.send({ "code": 0,message:"save error!" });
        }else{
          //提交转码作业 把作业jobid记录起来，供回调处理
          /*
          {"JobResultList":{"JobResult":[{"Job":{"CreationTime":"2015-11-17T10:33:45Z","Input":{"Bucket":"joygo","Location":"oss-cn-hangzhou","Object":"yingtan/1447724974777-123.flv"},"JobId":"d43dab04243e40ddb05dd21915a5c924","Output":{"OutputFile":{"Bucket":"joygo","Location":"oss-cn-hangzhou","Object":"yingtan_outfiles/123.mp4"},"Priority":"6","TemplateId":"73daf70137d8ec5a63f11edbf8e51e58"},"Percent":0,"PipelineId":"65eaa4c509ac42cba014fb81b03653f0","State":"Submitted"},"Success":true}]},"RequestId":"DA67D146-5DFA-43A7-A88B-765A039CC2CA"}
           */
          if(type==="0"){
            var params={inputfile:file,outfile:url};
            request.post({url:ALY.url,form:ALY.mts.SubmitJobs(params)},function(err,response, body){
              var info=JSON.parse(body);
              console.log(body);
              info.JobResultList.JobResult.forEach(function(node,index){
                new Alysjobs({
                  requestid:info.RequestId,
                  jobid:node.Job.JobId,
                  pid:postsalbums._id,
                }).save(function(err){})
              })
            });
          }
          return res.send({ "code":1,message:"ok" });
        }
      })
    });
    Counters.findOneAndUpdate({_id:mid},{$inc:{seq:1}},{ upsert: true },proxy.done(function(model){
      proxy.emit('seq', model.seq);
    }));

    if(type==="0"){//视频
      request.post({url:ALY.url,form:ALY.mts.SubmitSnapshotJob(params)},proxy.done(function(response, body){
        var info=JSON.parse(body);
        console.log(body);
        proxy.emit('pics',ALY.ossimg+params.outfile+"@400w_300h_2e");
      }));
    }else{
        proxy.emit('pics',ALY.ossimg+file+"@400w_300h_2e");
    }
  })
}
//七牛callback写入视频信息
exports.set_posts_video=function(req,res){
  //console.log(req.body);

  var mpno=validator.trim(req.body.mpno);//用户id
  var nickname=validator.trim(req.body.nickname);
  var mid=validator.trim(req.body.mid);//活动id
  var bucket=validator.trim(req.body.bucket);
  var file=validator.trim(req.body.file);
  var type=validator.trim(req.body.type);
  if (!mpno || !mid)return res.send({ "code": 0,message:'Parameter is not empty!' });
  var dir='/upload/'+moment().format('YYYY-MM-DD');
  Sysconfigs.findOne({type:'blacklist',key:'blacklist'},function(err,sysconfigs){
    if(sysconfigs){
      if(sysconfigs.val.indexOf(mpno)>-1)return res.send({ "code": 0,message:'黑名单用户'});
    }
    var pics=req.body.pics?comm.base64_decode({
      base64str:req.body.pics,
      absolutelydir:'./public'+dir,
      relativedir:dir,
    }):'';
    var proxy = new eventproxy();
    proxy.all('seq',function(seq){
      var postsalbums=new Postsalbums({
        mid:mid,
        user:{
          mpno:mpno,
          nickname:nickname
        },
        video:{
          originalurl:file,
          bucket:bucket
        },
        type:type,
        pics:pics,
        no:seq,
        name:validator.trim(req.body.name),
        desc:validator.trim(req.body.desc),
        status:!type?2:-1
      });
      postsalbums.save(function(err){
        if(err){
          return res.send({ "code": 0,message:"save error!" });
        }else{
          return res.send({"code":1,message:"ok"});
        }
      })
    });
    Counters.findOneAndUpdate({_id:mid},{$inc:{seq:1}},{ upsert: true },proxy.done(function(model){
      proxy.emit('seq', model.seq);
    }));
  });
}
//七牛获取token
exports.get_uptoken=function(req,res){
  //提交转码作业 把作业jobid记录起来，供回调处理
  var ALY = require('../../lib/aly/util');
  var request = require('request');
  var params={inputfile:"yingtan/1447724974777-123.flv",outfile:"yingtan_outfiles/123.mp4"};
  request.post({url:ALY.url,form:ALY.mts.SubmitJobs(params)},function(err,response, body){
    console.log(body);
  });
  return res.send({code:1});
  /*
  var bucket=req.query.bucket;
  var type=req.query.type;
  var qiniu = require("qiniu");
  qiniu.conf.ACCESS_KEY = '0cQmZVCn-SQCP-HcfICViXQINyAw52qEpeqkgGDv';
  qiniu.conf.SECRET_KEY = 'v-t9vQfNARoLw1omfCumbidrHZ038E2cRTgq4ydo';
  var putPolicy = new qiniu.rs.PutPolicy(bucket);
  //putPolicy.callbackHost={};//回调host
  putPolicy.callbackBody= "name=$(fname)&bucket=$(bucket)&key=$(key)&mpno=$(x:mpno)&nickname=$(x:nickname)&type=$(x:type)&mid=$(x:mid)";//回调参数
  putPolicy.callbackUrl=config.website+"/"+config.version+"/api/set_posts_video";//回掉urlapplication/json
  putPolicy.scope=bucket;
  if(type){
    putPolicy.persistentOps="avthumb/mp4;",
    putPolicy.persistentNotifyUrl=config.website+"/"+config.version+"/api/set_qiniu_notify"
    putPolicy.persistentPipeline="yingtan";//队列名
  }

  return res.send({code:1,token:putPolicy.token()});*/
}
//七牛转码回调
exports.set_qiniu_notify=function(req,res){
  var postalbums={"video.url":req.body.items[0].key,status:-1};
  var where={"video.originalurl":req.body.inputKey,"video.bucket":req.body.inputBucket};
  Postsalbums.findOneAndUpdate(where,postalbums,function(err,model){
    return res.send({code:1});
  })
  //视频信息
  //http://7xoa6j.com1.z0.glb.clouddn.com/UAA-4hndfVc5V6DJX0EvslAUBBI=/FpI_C3PnDCR4ko7quOGgS4W6ZyTo?avinfo
}
exports.set_posts_albumns_assist=function(req,res){
  var mpno=validator.trim(req.body.mpno);//用户id
  var _id=validator.trim(req.body._id);//活动相册id
  if (!mpno || !_id)return res.send({ "code": 0,message:'Parameter is not empty!' });
  var date=moment().format('YYYY-MM-DD');
  Postsalbums.count({_id:_id,'user_like_this_post':{'$elemMatch':{'mpno':mpno,'time':{'$gte': date}}}},function(err,count){
    if(err)return res.send({code:0,message:'error!'});
    if(count)return res.send({code:2,message:'已经点过赞了!'});
    Postsalbums.findOne({_id:_id},function(err,model){
      model.user_like_this_post.push({mpno:mpno,time:date});
      model.assistcount+=1;
      model.save(function(err){
        if(err){
          return res.send({ "code": 0,message:"save error!" });
        }else{
          return res.send({"code":1,message:"success!"});
        }
      })
    })
  });
}
exports.get_posts_albums=function(req,res){
  var mpno=validator.trim(req.query.mpno);//用户id
  var name=validator.trim(req.query.name);//名字
  var mid=validator.trim(req.query.mid);//活动id
  var sort=validator.trim(req.query.sort);//0=最新(日期倒序) 1=全部(正序) 2=热门(按投票数)
  var options = comm.api_get_page_options(req);
  if(!mid)return res.send({ "code": 0,message:'mid is not empty' });
  var proxy=new eventproxy();
  proxy.all('list','juhe',function(list,juhe){
    var result={};
    if(juhe.length>0){
      result.totaluser=juhe[0].count;
      result.totalassistcount=juhe[0].total;
    }
    return response.api(res, result, list);
  })
  var query=Postsalbums.find({mid:mid,status:0});
  if(sort==='0')query.sort('-createtime');
  if(sort==='1')query.sort('createtime');
  if(sort==='2')query.sort('-assistcount');
  if(name!==''){
    if(!_.isNaN(Number(name)))query.where({'no':name});
    else{
      query.where({'name':eval("/"+name+"/")});
    }
  }
  query.skip(options.skip).limit(options.limit).select({status:0}).exec(proxy.done(function(models){
    models.forEach(function (node, index) {
      node = node.toObject();
      node.assisted = 0;//未点赞
      _.where(node.user_like_this_post,{mpno:mpno}).forEach(function(n,i){
        //console.log(moment().format('YYYY-MM-DD')>moment(n.time).format('YYYY-MM-DD'))
        if(moment().format('YYYY-MM-DD')===moment(n.time).format('YYYY-MM-DD')){
            node.assisted = 1;
        }
      })
      //if(_.some(node.user_like_this_post, { mpno:mpno }))node.assisted = 1
      node.createtime = parseInt(moment(node.createtime).format('X'));
      node.pics = comm.replace_pics(node.pics);
      node.video.url = comm.replace_pics(node.video.url);
      delete node.user_like_this_post;
      models[index] = node;
    });
    proxy.emit('list',models);
  }));
  var cachekey=_const.get_posts_albums+mid;
  cache.get(cachekey,proxy.done(function(cachemodel){
    if(cachemodel){
      proxy.emit('juhe',cachemodel);
    }else{
      Postsalbums.aggregate({$match:{mid:mid,status:0}},{$group:{_id:"$mid",total:{$sum:"$assistcount"},count:{$sum:1}}},proxy.done(function(models){
        proxy.emit('juhe',models);
      }))
    }
  }))
}
exports.get_posts_albums_isexist=function(req,res){
  var mpno=validator.trim(req.query.mpno);//用户id
  var mid=validator.trim(req.query.mid);//活动id
  if(!mid)return res.send({ "code": 0,message:'mid is not empty' });
  Postsalbums.count({mid:mid,'user_like_this_post.mpno':mpno},function(err,count){
    if(err || !count)return res.send({code:0});
    return res.send({code:1});
  });
}
exports.get_awards=function(req,res){
/*
  var Posts = require('../../models/posts').posts;
  var Columns = require('../../models/columns').columns;
  var proxy=new eventproxy();
  proxy.all('columnsmodels','postscount',function(columnsmodels,postscount){
   var data=[];
    columnsmodels.forEach(function(node,index){
      data.push({cid:node._id,name:node.name,total:postscount[index]});
    })
    return res.send(data);
  })
  Columns.find().select({_id:1,name:1}).exec(proxy.done(function(models){
    proxy.emit('columnsmodels',models);
    proxy.after( "postscount",models.length,function(postscount){
      proxy.emit('postscount',postscount);
    })
    models.forEach(function(node,i){

      Posts.find({'post_publish_status.cid':node._id}).exec(proxy.group('postscount',function (models) {
        var count=0;
        models.forEach(function(node,index){
          count+=node.clickcount;
        })
        console.log(count);
        return count;
      }));
    })
  }))*/
  Awards.find().exec(function(err,models){
    if (err)return res.send({ "code": 0,message:'no data or error' });
    return response.api(res, {}, models);
  })
}

//彩票投注
exports.set_awards=function(req,res){
  var mpno=validator.trim(req.body.mpno);//用户id
  var no=validator.trim(req.body.no);//用户id
  var result=validator.trim(req.body.result);//用户id
  if(no==="" || result==="")return res.send({ "code": 0,message:'no or result is not empty' });
  var resultarray=result.split(',');
  var noarray=no.split(',');
  if(resultarray.length!==noarray.length)return res.send({ "code": 0,message:'no or result parameter is illegal' });
  var successcount=0;
  noarray.forEach(function(node,index){
    var awards=new Awards({
      no:node,
      result:resultarray[index],
      mpno:mpno
    })
    awards.save(function(err){
      if(err)successcount++;
    });
  })
  if (successcount)return res.send({ "code": 0,message:'投注失败' });
  return res.send({ "code": 1,message:'投注成功' });
}
//处理置顶过期的记录
setInterval(function () {
    Alysjobs.findOne({status:0},function(err,model){
      if(err || !model){
        console.log("==== not data ====");
        return ;
      }
      var params={JobIds:model.jobid};
      request.post({url:ALY.url,form:ALY.mts.QueryJobList(params)},function(err,response, body){
        var info=JSON.parse(body);
        info.JobList.Job.forEach(function(node,index){
          if(node.JobId===params.JobIds){
            //转码结束视频变为待审核
            Postsalbums.findOneAndUpdate({_id:model.pid},{status:-1},function(err,model){
            })
            Alysjobs.findOneAndUpdate({_id:model._id},{status:1},function(err,model){})
          }
        })
        console.log(body)
      });
    })
}, 10*1000);

//投票竞猜
exports.set_user_ranking=function(req,res){
  var mpno=validator.trim(req.body.mpno);//用户手机号
  var user=validator.trim(req.body.user);//用户id
  var result=validator.trim(req.body.result);//用户结果
  var name=validator.trim(req.body.name);//用户姓名
  if(mpno==="" || result==="" || user==="" || name==="")return res.send({ "code": 0,message:'user or mpno or result is not empty' });
    var ranking=new Ranking({
      user:user,
      result:result,
      mpno:mpno,
      name:name
    });
    ranking.save(function(err){
      if(err){
        return res.send({ "code": 0,message:"save error!" });
      }else{
        return res.send({"code":1,message:"success!"});
      }
    });
};
exports.get_ranking=function(req,res){
  var user=validator.trim(req.query.user);//用户id
  Ranking.findOne({user:user},function(err,model){
    if(err || !model){
      return res.send({ "code": 0,message:"error or no model" });
    }else if(model){
      return res.send({"code":1,list:model});
    }
  })
}
//问吧提问
exports.set_new_questions=function(req,res){
  var content=validator.trim(req.body.content);     
  var publishmpno=validator.trim(req.body.publishmpno);       
  var publishusername=validator.trim(req.body.publishusername);
  var publishuserface=validator.trim(req.body.publishuserface);
  var answermpno=validator.trim(req.body.answermpno);
  var answerusername=validator.trim(req.body.answerusername);
  var answeruserface=validator.trim(req.body.answeruserface);
  var answercontent=validator.trim(req.body.answercontent);
  var questiontype=validator.trim(req.body.questiontype);
  var questionvtype=validator.trim(req.body.questionvtype);
  var questions = new Questions({
    content:content,
    publishmpno:publishmpno,
    publishusername:publishusername,
    publishuserface:publishuserface,
    questiontype:questiontype,
    questionvtype:questionvtype,
    answermpno:answermpno,
    answerusername:answerusername,
    answeruserface:answeruserface,
    answercontent:answercontent,
    status: 0
  });
  questions.save(function(err) {
    if (err) {
      return res.send({ "code": 0,message:"error" });
    } else {
      var result = "";
      //写入主播提问数
      Anchors.findOneAndUpdate({mpno: publishmpno}, {$inc: {"questionscount": 1}}, function(err) {
        if (err) {
          return res.send({ "code": 0,message:"error" });
        } else {
          //写入主播被问数
          Anchors.findOneAndUpdate({mpno: publishmpno}, {$inc: {"askedcount": 1}}, function(err) {
            if (err) {
              return res.send({ "code": 0,message:"error" });
            } else {
              return res.send({"code":1});
            }
          })
        }
      })
    }
  });
}
//合作单位

exports.get_cooper=function(req,res){
  Cooper.find({status:0},function(err,models){
    if(err){
      console.log(err);
      return res.send({ "code": 0,message:"error" });
    }else{ 
      models.forEach(function (node, index) {
        node = node.toObject();
        node.img=config.imgsite+node.img;
        node.url=config.imgsite+'/html5/page/businesses/share.html?id='+node._id
        models[index] = node;
      });
      return response.api(res,{}, models);
    }
  })
};
exports.cooper_detail=function(req,res){
  var _id=validator.trim(req.query.id);
  var mpno=validator.trim(req.query.mpno);
  var where={};
  if(mpno){
    where.mpno=mpno
  }
  if(_id){
    where._id=_id
  }
  if(!mpno && !_id){
    return res.send({ "code": 0,message:"empty mpno or id" });
  }
  Cooper.find(where,function(err,model){
    if(!model || err){
      console.log(err);
      return res.send({ "code": 0,message:"error" });
    }else{
      model.forEach(function (node, index) {
        var img=config.imgsite+node.img;
        node.img=img
      });
      return response.api(res,{}, model);
    }
  })
};
exports.set_cooper=function(req,res){
  var dir='/upload/'+moment().format('YYYY-MM-DD');     
  var _id=validator.trim(req.body.id);
  var name=validator.trim(req.body.name);     
  var img=req.body.img?comm.base64_decode({
        base64str:req.body.img,
        absolutelydir:'./public'+dir,
        relativedir:dir,
      }):'';       
  var desc=validator.trim(req.body.desc);
  var ads=validator.trim(req.body.ads);
  var mpno=validator.trim(req.body.mpno);
  var phone=validator.trim(req.body.phone);
  var nickname=validator.trim(req.body.nickname);
  var cause=validator.trim(req.body.cause);
  if(_id){
    var cooperation = {
      name: name,
      desc: desc,
      ads: ads,
      phone: phone,
      nickname: nickname,
      cause: cause,
      status:1,
      faith:0
    };
    if(img){  
      cooperation.img=img;
    }
    Cooper.update({_id:_id} , cooperation , { upsert: true } ,function(err){
      if(err){
        console.log(err);
        return res.send({ "code": 0,message:"error" });
      }else{
        return res.send({"code":1})
      }
    })
  }else{ 
    var cooperation = new Cooper({
      phone: phone,
      name: name,
      img: img,
      desc: desc,
      ads: ads,
      mpno: mpno,
      nickname: nickname,
      cause: cause
    });
    cooperation.save(function(err) {
      if (err) {
        return res.send({ "code": 0,message:"error" });
      } else {
        return res.send({"code":1});
      }
    });
  }
}