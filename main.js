//jshint esversion:6
//require("dotenv").config();
const express = require("express");
const bodyparser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

//represent modules
const app = express();

app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: "Our few little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

//connect mongoose.
mongoose.connect("mongodb://localhost:27017/secretDB", {
  useNewUrlParser: true,
});
//mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  secret: String
});
userSchema.plugin(passportLocalMongoose); //salt schema
userSchema.plugin(findOrCreate);
const userModel = new mongoose.model("User", userSchema);

passport.use(userModel.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  userModel.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID:
        "270089191625-4kcje9pg006mn0m1v3oqg0oop2hhk9v2.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "http://localhost:3000/auth/google/secret",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      userModel.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.route("/").get(function (request, response) {
  response.render("home");
});

app.get("/auth/google", function (request, response) {
  passport.authenticate("google", { scope: ["profile"] });
});

app.get(
  "/auth/google/secret",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect secret page.
    res.redirect("/secret");
  }
);

app
  .route("/register")
  .get(function (request, response) {
    response.render("register");
  })
  .post(function (request, response) {
    const username = request.body.username;
    const password = request.body.passport;
    userModel.register(
      { username: request.body.username },
      request.body.password,
      function (error, newUser) {
        if (error) {
          response.send(error);
        } else {
          passport.authenticate("local")(request, response, function () {
            response.redirect("/secret");
          });
        }
      }
    );
  });

app
  .route("/login")
  .get(function (request, response) {
    response.render("login", { warningNote: "" });
  })
  .post(function (request, response) {
    const user = new userModel({
      username: request.body.username,
      passport: request.body.passport,
    });

    request.login(user, function (error) {
      if (error) {
        response.send(error);
      } else {
        passport.authenticate("local")(request, response, function () {
          response.redirect("/secret");
        });
      }
    });
  });

app.route("/secret").get(function (request, response) {

  userModel.find({"secret": {$ne: null}}, function(error, foundUsers){
    if(error){
      response.send(error);
    } else  {
      if(foundUsers){
        response.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  });

  // if (request.isAuthenticated()) {
  //   response.render("secrets");
  // } else {
  //   response.redirect("/login");
  // }
});
app.route("/submit").get(function(equest, response){
  response.render("submit");
}).post(function(request, response){
  const submittedsecret = request.body.secret;
  console.log(request.user.id);
  userModel.findById(request.user.id, function(error, foundUser){
    if(error){
      response.send(error);
    } else  {
      if(foundUser){
        foundUser.secret = submittedsecret;
        foundUser.save(function(error){
          if(error){
            console.log(error);
        } else  {
          response.redirect("/secret");
        }
        });
      }
    }
  });
});

app.get("/logout", function (request, response) {
  request.logout();
  response.redirect("/");
});

//listening port
app.listen(3000, function () {
  console.log("server has started on port 3000");
});
