var config = require('../config');

// Hooks-Server
/* eslint-disable */
const {add_filter, remove_filter, add_action, 
  remove_action, do_action, apply_filters 
} = require("../plugin/hooks-server/hooks-server.js");
/* eslint-enable */

// ～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～

// WebSocket
var fs = require('fs');
const ws = require("../plugin/ws/index.js");
var wsport = config.WebSocketPort;

// Define WSS
var options = {
  secure: true,
  key: fs.readFileSync(config.wsKey),
  cert: fs.readFileSync(config.wsCert)
}

module.exports = function (print, errorlog, chatlog, nlp_info, dbCache) {
  var threshold = nlp_info[0];
  var nlpManagerBrock = nlp_info[1];
  var nlpManagerGame = nlp_info[2];

  // Define WebSocket
  //var server = 
  ws.createServer(options, conn=> {
    print("New Connection")
    
    conn.on("text", function (data) {
      print("Message Received")
      var obj = {};
      try {
        obj = JSON.parse(data);
      } catch(e) {
        print(e)
      }
      do_action(`received`,conn,obj);
      do_action(`received_${obj.type}_${obj.version}`,conn,obj);
    })

    conn.on("close", function (code, reason) {
      print("Connection closed");
      do_action(`closed`,conn);
      do_action(`closed_${reason}`,conn);
    })
    
    conn.on("error",function(err){
      errorlog("WebSocket Error Occour - " + err);
    })

  }).listen(wsport)
  print('Core: WebSocket Server Listening on Port ' + wsport);

  // ～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～

  // Receive message
  // Brock
  var receivedTextBrock = (conn,obj)=>{
    (async () => {
      if (obj.extra=="news" && obj.msg != "Exit News Search"){

        const brockNews = require('./crawler/brockNews');
        brockNews('search', obj.msg, 0, null, print, errorlog, function (all_news) {
          var send = { 'type': 'news', 'text': 'Here are some news about '+obj.msg, 'news': all_news, 'disableInput': false, 'options': [
              {
                'text': 'Exit News Search',
                'value': 'Exit News Search',
                'action': 'postback'
              }
            ]}
          conn.sendText(JSON.stringify(send));
          return
        });

        // const test = require('./newsEngine/brockNewsEngine');
        // test(print,errorlog, obj.msg,function (data) {
        //   if (data=="notfound"){
        //     obj.extra="";
        //     receivedTextBrock(conn,obj)
        //   }else{
        //     //console.log(data);
        //     answer = data
        //     chatlog("Brock| User: " + obj.msg + " | Bot: " + answer);
        //     var send = { 'type': 'button', 'text': answer, 'disableInput': false, 'options': [
        //       {
        //         'text': 'Exit News Search',
        //         'value': 'Exit News Search',
        //         'action': 'postback'
        //       }
        //     ]}
        //     conn.sendText(JSON.stringify(send));
        //     return
        //   }
        // });
        return
      }
      // Pocess NLP
      // nlpManagerBrock.addDocument('en', 'My mail is %email%', 'email');
      // nlpManagerBrock.addDocument('en', 'My email is %email%', 'email');
      // nlpManagerBrock.addDocument('en', 'Here you have my email: %email%', 'email');
      // nlpManagerBrock.addAnswer('en', 'email', 'Your email is {{email}}');
      const result = await nlpManagerBrock.process(obj.msg);
      // console.log(result);
      // const result2 = await nlpManagerBrock.extractEntities('en', obj.msg);
      // console.log(result2);
      // Get Answer
      var answer = result.score > threshold && result.answer
        ? result.answer
        : '!json-{"type":"button","text":"Sorry, I don\'t understand, but maybe you can find answer here.","disableInput":false,"options":[{"text":"Find it out","value":"http://www.google.com/search?q='+encodeURIComponent(obj.msg)+'","action":"url"}]}';
      var answer2 = (' ' + answer).slice(1);

      chatlog("Brock| User: " + obj.msg + " | Bot: " + answer);

      // Process Answer if needed
      answer = apply_filters("answer_process_brock", {obj,answer,conn,dbCache,print,errorlog});

      // Reply to Client by text
      var send = { 'type': 'text', 'text': answer, 'disableInput': false }

      if (answer == "!ignore"){ // Ignore this send
        return;
      }else if (answer == "!json"){ // Send this json directly
        const param = answer2.substr(answer2.indexOf('-')+1,answer2.length-1);
        conn.sendText(param);
        return;
      }
      conn.sendText(JSON.stringify(send)); // Send to Client

      // Sentiment
      // let sentiment = '';
      // if (result.sentiment.score !== 0) {
      //     sentiment = `  ${result.sentiment.score > 0 ? ':)' : ':('}   (${
      //     result.sentiment.score
      //   })`;
      // }
      // print(`bot> ${answer} : ${sentiment}`);

    })();
  };
  add_action('received_text_brock',receivedTextBrock);

  // ～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～

  // Process answer if needs an action "!"
  var answerProcessBrock = require('../components/answerProcess/answerProcessBrock.js');
  add_filter('answer_process_brock',answerProcessBrock);

  // ～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～

  // Receive message
  // Canada Game
  var receivedTextGame = (conn,obj)=>{
    (async () => {
      // Pocess NLP
      const result = await nlpManagerGame.process(obj.msg);
      // Get Answer
      var answer = result.score > threshold && result.answer
        ? result.answer
        : '!json-{"type":"button","text":"Sorry, I don\'t understand, but maybe you can find answer here.","disableInput":false,"options":[{"text":"Find it out","value":"http://www.google.com/search?q='+encodeURIComponent(obj.msg)+'","action":"url"}]}';
      var answer2 = (' ' + answer).slice(1);

      chatlog("Game| User: " + obj.msg + " | Bot: " + answer);

      // Process Answer if needed
      answer = apply_filters("answer_process_game", {obj,answer,conn,dbCache,print,errorlog});

      // Reply to Client by text
      var send = { 'type': 'text', 'text': answer, 'disableInput': false }

      if (answer == "!ignore"){ // Ignore this send
        return;
      }else if (answer == "!json"){ // Send this json directly
        const param = answer2.substr(answer2.indexOf('-')+1,answer2.length-1);
        conn.sendText(param);
        return;
      }
      conn.sendText(JSON.stringify(send)); // Send to Client

    })();
  };
  add_action('received_text_game',receivedTextGame);

  // ～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～

  // Process answer if needs an action "!"
  var answerProcessGame = require('../components/answerProcess/answerProcessGame.js');
  add_filter('answer_process_game',answerProcessGame);

};
