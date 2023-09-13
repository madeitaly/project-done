import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import _ from "lodash"

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

// main().catch((err) => console.log(err));
// async function main() {
//   await mongoose.connect(mongoDB);
// }

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
    items: [itemSchema],
    index: Number
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
const defaultList = new List( {
    name: "Today",
    items: defaultItems,
    index: 0
});

//Function to return the number of lists on the 
async function getListCounter() {
    
    const foundLists = await List.find().exec();
    return foundLists.length;
}

/////////////////////////////////////
//  ROUTING OF THE HTTPS REQUESTS ///
/////////////////////////////////////

app.get("/", async function(req,res) {

    const listCounter = await getListCounter();
   
    //If there are no lists then create a default Today list
    if(listCounter === 0) {
        List.create(defaultList)
        .then(function() {
            console.log(`Created default Today List`);
        })
        .catch(function(err) {
            console.log(err);
        });
    }

    //Find the items in Today List and render the page
    List.findOne({name: "Today"})
    .then(function(todayList) {

        if(todayList.items.length === 0) {
            //Add default Items to Today's List
            todayList.items = defaultItems;
            todayList.save()
            .then(res.redirect("/"))
            .catch(function(err) {
                console.log(err);
            })
        } else {
            //Render the default List
            res.render("list", { listTitle: todayList.name, newListItems: todayList.items })
        }     
    })
    .catch(function(err) {
        console.log(err);
    })
})


app.get("/:customListName", async function(req,res) {
    
    let listIndex = await getListCounter();
    
    const customListName = _.capitalize(req.params.customListName);

    List.findOne({name: customListName})
    .then(function(foundList) {
        if(!foundList) {
            //Create the new list here
            const newList = new List({
                name: customListName,
                items: defaultItems,
                index: listIndex
            });

            newList.save()
            .then(function() {
                console.log(`Created new List, index ${listIndex}`);
                res.redirect("/" + customListName);
            })
            .catch(function(err) {
                console.log(err);
            })
        } else {
            // Show an existing List
            res.render("list", { listTitle: foundList.name, newListItems: foundList.items })
        }
    })
    .catch(function(err) {
        console.log(err);
    })
})


app.post("/", async function(req,res) {

    const currentList = req.body.list;
    const newItem = new Item({
        name: req.body.newItem
    });
    
    if(currentList === "Today"){
        List.findOne({name: "Today"})
        .then(function(foundList) {
            
            foundList.items.push(newItem);

            foundList.save()
            .then(res.redirect("/"))
            .catch(function(err) {
                console.log(err);
            })
        })
        .catch(function(err) {
            console.log(err);
        })
    } else {
        List.findOne({name: currentList})
        .then(function(foundList) {

            //console.log(`This is the List ${foundList}`);

            foundList.items.push(newItem);

            foundList.save()
            .then(res.redirect("/" + currentList))
            .catch(function(err) {
                console.log(err);
            })
        })
        .catch(function(err) {
            console.log(err);
        })
    }
})

app.post("/delete", function(req,res) {

    const listName = req.body.listName;
    const deletedItemId= req.body.itemToDelete;

    List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: deletedItemId}}})
    .then(function() {
        console.log(`Successfully deleted item ${deletedItemId}`);
        if( listName === "Today") {
            res.redirect("/");
        } else {
            res.redirect("/" + listName);
        }})
    .catch(function(err) {
        console.log(err);
    });
})

app.post("/update", async function(req,res) {

    // const itemToUpdate = await Item.findById(req.body.checkbox);
    // console.log(itemToUpdate);
    // itemToUpdate.done = !(itemToUpdate.done);
    // await itemToUpdate.save();
    //Update the DONE status of the item
    // const itemToUpdate = await Item.findById(req.body.checkbox);
    
    //console.log(itemToUpdate);
    //if(!itemToUpdate.done) {
        // Item.findByIdAndUpdate(itemToUpdate._id, {done: !done})
        // .then(function(){
        //     console.log("Item marked as done!");
        // })
        // .catch(function(err) {
        //     console.log(err);
        // })
   // } else {
    //     Item.findByIdAndUpdate(itemToUpdate._id, {done: false})
    //     .then(function(){
    //         console.log("Item marked as NOT done!");
    //     })
    //     .catch(function(err) {
    //         console.log(err);
    //     })
    // }
    res.redirect("/");
})

app.post("/next", async function(req,res) {
    //Find biggest list's index
    let maxIndex = await getListCounter();
    const currentList = req.body.listName;

    //Find the current list index
    List.findOne({name: currentList})
    .then(function(foundList) {
        //Determine the index of the next list:
        let nextListIndex = foundList.index + 1;
        if(nextListIndex === maxIndex )
        {
            nextListIndex = 0;
        }
        //Retrive the next List to display
        List.findOne({index: nextListIndex})
        .then(function(nextList){
            console.log(`Next List is ${nextList.name}, with index ${nextList.index}`);
            res.redirect("/" + nextList.name);
        })
        .catch(function(err) {
            console.log(err);
        })
    })
    .catch(function(err) {
        console.log(err);
    })
})

app.post("/previous", async function(req,res) {
    //Find biggest list's index
    let maxIndex = await getListCounter();
    const currentList = req.body.listName;

    //Find the current list index
    List.findOne({name: currentList})
    .then(function(foundList) {
        //Determine the index of the next list:
        let prevListIndex = foundList.index - 1;
        if(prevListIndex < 0 )
        {
            prevListIndex = maxIndex-1;
        }
        //Retrive the next List to display
        List.findOne({index: prevListIndex})
        .then(function(prevList){
            console.log(`Previous List is ${prevList.name}, with index ${prevList.index}`);
            res.redirect("/" + prevList.name);
        })
        .catch(function(err) {
            console.log(err);
        })
    })
    .catch(function(err) {
        console.log(err);
    })
})


app.listen(port, function() {
    console.log(`Server running on port ${port}`);
})