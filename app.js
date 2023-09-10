import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser';
import mongoose from 'mongoose';

const app = express();

// Environmental Variables 
const port = process.env.PORT;
const adminUser = process.env.MONGO_USER;
const adminPass = process.env.MONGO_PASSWORD;


app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended : true}));
app.use(express.static("public"));

// MongoDB Atlas connection
mongoose.set('strictQuery', true);
mongoose.connect(`mongodb+srv://${adminUser}:${adminPass}@cluster0.ecvxgsf.mongodb.net/projectdoneDB`);


// Mongoose models
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
    items: [itemSchema]
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


app.get("/", function(req,res) {

    Item.find()
    .then (function(foundItems) {
        if(foundItems.length === 0) {
            Item.insertMany(defaultItems)
            .then(function (){
                console.log("Successfully added Items to the DB");
            })
            .catch(function(err) {
                console.log(err);
            })
            res.redirect("/");
        } else {
            res.render("list", {newListItems: foundItems});
            // console.log(foundItems);
        }
    })
    .catch(function(err) {
        console.log(err);
    })
})


app.post("/", function(req,res) {

    const item = new Item({
        name: req.body.newItem
    });

    item.save()
    .then(res.redirect("/"))
    .catch(err => {
        console.log(err);
    })    
})

app.post("/delete", function(req,res) {

    Item.findByIdAndRemove(req.body.itemToDelete)
    .then(function() {
        console.log("Successfully deleted checked item!");
        res.redirect("/");
    })
    .catch(function(err) {
        console.log(err);
    })
})

app.post("/update", async function(req,res) {
    //Update the DONE status of the item
    const itemToUpdate = await Item.findById(req.body.checkbox);
    
    console.log(itemToUpdate);
    if(!itemToUpdate.done) {
        Item.findByIdAndUpdate(itemToUpdate._id, {done: true})
        .then(function(){
            console.log("Item marked as done!");
        })
        .catch(function(err) {
            console.log(err);
        })
    } else {
        Item.findByIdAndUpdate(itemToUpdate._id, {done: false})
        .then(function(){
            console.log("Item marked as NOT done!");
        })
        .catch(function(err) {
            console.log(err);
        })
    }
    res.redirect("/");
})

app.post("/next", function(req,res) {
    res.redirect("/");
})

app.post("/previous", function(req,res) {
    res.redirect("/");
})


app.listen(port, function() {
    console.log(`Server running on port ${port}`);
})