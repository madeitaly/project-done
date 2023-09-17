import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import _ from "lodash"
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import findOrCreate from "mongoose-findorcreate";


const app = express();

// Environmental Variables 
const port = process.env.PORT;
const adminUser = process.env.MONGO_USER;
const adminPass = process.env.MONGO_PASSWORD;


app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

//Set up Session and Passport to manage these Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// MongoDB Atlas connection
mongoose.set('strictQuery', true);
mongoose.connect(`mongodb+srv://${adminUser}:${adminPass}@cluster0.ecvxgsf.mongodb.net/projectdoneDB`);

// main().catch((err) => console.log(err));
// async function main() {
//   await mongoose.connect(mongoDB);
// }

// Mongoose models
const userSchema = new mongoose.Schema({
    email: String,
    password: String, 
    googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});


//OAuth2.0 with Google
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://tricky-bear-gloves.cyclic.app/auth/google/" //,
    //userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));


const itemSchema = {
    name: String,
    done: {
        type: Boolean,
        default: false
    }
};

const Item = mongoose.model("Item", itemSchema);

const listSchema = {
    name: String,
    items: [itemSchema],
    index: Number,
    created: Date
};

const List = mongoose.model("List", listSchema);

// Default Items for new list
const item1 = new Item({
    name: "Hit the + button to add a new item.",
    done: false
});

const item2 = new Item({
    name: "<-- Hit this to mark an item as DONE.",
    done: false
});

const item3 = new Item({
    name: "Hit this to remove an item -->",
    done: false
});

const defaultItems = [item1, item2, item3];

// Default Today list when all lists are deleted
const defaultList = new List({
    name: "Today",
    items: defaultItems,
    index: 0,
    created: new Date(Date.now()).toLocaleString()
});

//Function to return the number of lists on the 
async function getListCounter() {

    const foundLists = await List.find().exec();
    return foundLists.length;
}

//Function to return the last index used
async function getMaxIndex() {
    const maxIndexList = await List.findOne().sort({ index: -1 });
    return maxIndexList.index;
}

//Function that returns the next index to be used
async function getNextIndex() {
    const nextIndex = await getMaxIndex();
    return (nextIndex + 1);
}

//Function to create the default collection TODAY
async function createDefaultList() {
    List.create(defaultList)
        .then(function () {
            console.log(`Created default Today List`);
        })
        .catch(function (err) {
            console.log(err);
        });
}

/////////////////////////////////////
//  ROUTING OF THE HTTPS REQUESTS ///
/////////////////////////////////////
app.get("/home", function(req, res) {
    res.render("home");
})

app.get("/login", function(req, res) {
    res.render("login");
})

app.get("/register", function(req, res) {
    res.render("register");
})

app.get("/auth/google",
    passport.authenticate('google', { scope: ['profile'] })
);

app.get("/auth/google/",
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect .
        res.redirect("/");
    }
);

app.get("/logout", function(req,res) {
    req.logout((err)=>{
        if(err){
            console.log(err);
        }else{
            res.redirect("/home");
        }
    });
})

app.post("/register", function(req,res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if(err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req,res,() => {
                res.redirect("/");
            });
        }
    })
})

app.post("/login", function(req,res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if(err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/");
            })
        }
    })
})


app.get("/", async function (req, res) {

    //Verify if the user is logged in
    if(req.isAuthenticated()){
        const listCounter = await getListCounter();

        //If there are no lists then create a default Today list
        if (listCounter === 0) {
            await createDefaultList();
        }

        //Find the items in Today List and render the page
        await List.findOne({ name: "Today" })
            .then(function (todayList) {
                if (todayList.items.length === 0) {
                    //Add default Items to Today's List
                    todayList.items = defaultItems;
                    todayList.save()
                        .then(res.redirect("/"))
                        .catch(function (err) {
                            console.log(err);
                        })
                } else {
                    //Render the default List
                    res.render("list", {
                        listTitle: todayList.name,
                        newListItems: todayList.items,
                        creationDate: todayList.created
                    })
                }
            })
            .catch(function (err) {
                console.log(err);
            })
    } else {
        res.redirect("/home");
    }
    
})


app.get("/:customListName", async function (req, res) {

    let listIndex = await getNextIndex();

    const customListName = _.capitalize(req.params.customListName);

    List.findOne({ name: customListName })
        .then(function (foundList) {
            if (!foundList) {
                //Create the new list here
                const newList = new List({
                    name: customListName,
                    items: defaultItems,
                    index: listIndex,
                    created: new Date(Date.now()).toLocaleString()
                });

                newList.save()
                    .then(function () {
                        console.log(`Created new List, index ${listIndex}`);
                        res.redirect("/" + customListName);
                    })
                    .catch(function (err) {
                        console.log(err);
                    })
            } else {
                // Show an existing List
                res.render("list", {
                    listTitle: foundList.name,
                    newListItems: foundList.items,
                    creationDate: foundList.created
                })
            }
        })
        .catch(function (err) {
            console.log(err);
        })
})


app.post("/", async function (req, res) {

    const currentList = req.body.list;
    const newItem = new Item({
        name: req.body.newItem
    });

    List.findOne({ name: currentList })
        .then(function (foundList) {

            //console.log(`This is the List ${foundList}`);

            foundList.items.push(newItem);

            foundList.save()
                .then(function () {
                    if (currentList === "Today") {
                        res.redirect("/");
                    } else {
                        res.redirect("/" + currentList);
                    }
                })
                .catch(function (err) {
                    console.log(err);
                })
        })
})

app.post("/delete", function (req, res) {

    const listName = req.body.listName;
    const deletedItemId = req.body.itemToDelete;

    List.findOneAndUpdate({ name: listName }, { $pull: { items: { _id: deletedItemId } } })
        .then(function () {
            console.log(`Successfully deleted item ${deletedItemId}`);
            if (listName === "Today") {
                res.redirect("/");
            } else {
                res.redirect("/" + listName);
            }
        })
        .catch(function (err) {
            console.log(err);
        });
})

app.post("/update", async function (req, res) {

    const listName = req.body.listName;
    const updatedItem = req.body.itemId;

    List.findOne({ name: listName })
        .then(function (foundList) {
            foundList.items.forEach(function (item) {

                if (item._id == updatedItem) {
                    //console.log(`Found item ${item._id}`);
                    if (item.done === false) {
                        item.done = true;
                    } else {
                        item.done = false;
                    }
                }
            })

            //console.log(foundList);
            foundList.save()
                .then(function () {
                    console.log("Updated List");
                    if (listName === "Today") {
                        res.redirect("/");
                    } else {
                        res.redirect("/" + listName);
                    }
                })
                .catch(function (err) {
                    console.log(err);
                })
        })
        .catch(function (err) {
            console.log(err);
        })
})

app.post("/next", async function (req, res) {
    //Find biggest list's index
    const maxIndex = await getMaxIndex();

    const currentList = req.body.listName;

    //Find the current list index
    List.findOne({ name: currentList })
        .then(async function (foundList) {
            if (foundList.index === maxIndex) {
                console.log(`Next List is Today, with index 0`);
                res.redirect("/");

            } else {
                // Determine next index
                const nextList = await List.findOne({ index: { $gt: foundList.index } });
                console.log(`Next List is ${nextList.name}, with index ${nextList.index}`);
                res.redirect("/" + nextList.name);
            }
        })
        .catch(function (err) {
            console.log(err);
        })
})

app.post("/previous", async function (req, res) {
    //Find biggest list's index
    const maxIndex = await getMaxIndex();

    const currentList = req.body.listName;

    //Find the current list index
    List.findOne({ name: currentList })
        .then(async function (foundList) {
            if (foundList.index === 0) {
                //Find list with maxIndex
                const maxIndexList = await List.findOne({ index: maxIndex });
                console.log(`Previous List is ${maxIndexList.name}, with index ${maxIndexList.index}`);
                res.redirect("/" + maxIndexList.name);
            } else {
                //List with lower index
                const prevLists = await List.find().sort({ index: -1 });
                //console.log(prevLists);
                var tempPrevIndex = 0;

                prevLists.forEach(function (list) {
                    if (list.index < foundList.index && list.index > tempPrevIndex) {
                        tempPrevIndex = list.index
                    }
                })

                const prevList = await List.findOne({ index: tempPrevIndex });
                console.log(`Previous List is ${prevList.name}, with index ${prevList.index}`);
                res.redirect("/" + prevList.name);
            }
        })
        .catch(function (err) {
            console.log(err);
        })
})

app.post("/del", async function (req, res) {
    const listToDelete = req.body.listName;

    List.deleteOne({ name: listToDelete })
        .then(function () {
            console.log(`Deleted List ${listToDelete}`);
        })
        .catch(function (err) {
            console.log(err);
        })

    res.redirect("/");
})

app.post("/new", async function (req, res) {
    const newListName = req.body.listName;
    console.log(newListName);

    res.redirect("/" + newListName);
})


app.listen(port, function () {
    console.log(`Server running on port ${port}`);
})