var User = require('./models/user');
var Bear = require('./models/bear');
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens

module.exports = function(app, passport) {

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function(req, res) {
        res.render('index.ejs');
    });

    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function(req, res, next) {
        findUser(req.user).then(user => {

            const responseJSON = {_id:user._id, email:user.local.email};            
            tokenAuthentication(app, req, res, next, responseJSON);
       })
       .catch((err) => {
            res.send(err);
        });
    });

    // app.get('/profile', isLoggedIn, function(req, res) {
    //     res.render('profile.ejs', {
    //         user : req.user
    //     });
    // });


    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.json({logout: true});
    });

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
        // LOGIN ===============================
        // show the login form
        app.get('/login', function(req, res) {
            res.render('login.ejs', { message: req.flash('loginMessage') });
        });

       app.post('/login', function(req, res, next) {
          passport.authenticate('local-login', function(err, user) {
             if (err) { return next(err); }
             if (!user) {
                return res.send(401,{ success : false, message : 'authentication failed' });
             }
             req.logIn(user, function(err) {
                if (err) { return next(err); }

                const payload = {admin: true};
                var token = jwt.sign(
                   payload, app.get('secret'),
                   {expiresIn : '2m'}
                );
                console.log(62, user);
                return res.json({
                   _id: user._id, 
                   email : user.local.email,
                   token,
                })
             });
          })(req, res, next);
       });

        // GET USERS ==============================

         app.get('/users', isLoggedIn, function (req, res) {
             User.find(function (err, users) {
                if (err)
                   res.send(err);
                res.json(users);
             });
          });

        // SIGNUP =================================
        // show the signup form
        app.get('/signup', function(req, res) {
            res.render('signup.ejs', { message: req.flash('signupMessage') });
        });

        // process the signup form
        app.post('/bang', passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/signup', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

        app.post('/signup', function(req, res, next) {
            passport.authenticate('local-signup', function(err, user) {
                if (err) { return next(err); }
                if (user) {
                   return res.send(200,{ success : true, message : 'user created!' });
                } else {
                   return res.send(401,{ success : false, message : 'user already exists!' });
                }
        })(req, res, next);
   });


// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });



   app.post('/bear', isLoggedIn, function(req, res) {

      var bear = new Bear();      // create a new instance of the Bear model
      bear.name = req.body.name;  // set the bears name (comes from the request)

      // save the bear and check for errors
      bear.save(function(err) {
         if (err)
            res.send(err);

         res.json({ message: 'Bear created!' });
      });

   });

   app.get('/bear', isLoggedIn, function(req, res, next) {
      Bear.find(function(err, bears) {
         if (err)
            res.send(err);
         tokenAuthentication(app, req, res, next, bears);
      });
   });

   app.get('/bear/:bear_id', isLoggedIn, function(req, res) {
      Bear.findById(req.params.bear_id, function(err, bear) {
         if (err)
            res.send(err);
         res.json(bear);
      });
   });
};

const tokenAuthentication = (app, req, res, next, response) => {
   const token = req.body.token || req.query.token || req.headers['x-access-token'];
   if (token) {
      jwt.verify(token, app.get('secret'), function(err, decoded) {
         if (err) {
            return res.json(401, { success: false, message: 'Failed to authenticate token.' });
         } else {
            // if everything is good, save to request for use in other routes
            req.decoded = decoded;
            res.json(response);
            next();
         }
      });
   } else {
      return res.status(403).send({
         success: false,
         message: 'No token provided.'
      });
   }
}

// route middleware to ensure user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated())
        return next();
      res.send(401,{ success : false, message : 'you need to be logged in' });
}

const findUser = userToFind => (
    new Promise((resolve, reject) => {
        User.find((err, users) => {
            if (err) {
                reject(err);
            }
            const reqEmail = userToFind.local.email;
            const user = users.find(u=> (
                u.local.email === reqEmail
            ))
            resolve(user) ;
        });
    })
);
