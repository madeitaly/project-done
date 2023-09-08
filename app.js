import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser';
import { log } from 'console';

const app = express();

const port = process.env.PORT;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended : true}));
app.use(express.static("public"));




app.listen(port, function() {
    console.log(`Server running on port ${port}`);
})