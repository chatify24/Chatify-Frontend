import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function GoogleAuth() {

const navigate = useNavigate();
const { toast } = useToast();

useEffect(() => {

const params = new URLSearchParams(window.location.search);

const email = params.get("email");
const mode = params.get("mode");

if(!email || !mode){
navigate("/");
return;
}

const stored = localStorage.getItem("chat_accounts");
const accounts = stored ? JSON.parse(stored) : {};

if(mode === "login"){

if(!accounts[email]){
toast({
title: "Account not found",
description: "Please sign up first",
variant: "destructive"
});
navigate("/");
return;
}

localStorage.setItem("current_user",email);
navigate("/profile");
return;

}

if(mode === "signup"){

if(accounts[email]){
toast({
title: "Account already exists",
description: "Please sign in",
variant: "destructive"
});
navigate("/");
return;
}

accounts[email] = { provider:"google" };

localStorage.setItem("chat_accounts",JSON.stringify(accounts));
localStorage.setItem("current_user",email);

navigate("/profile");

}

},[]);

return null;

}