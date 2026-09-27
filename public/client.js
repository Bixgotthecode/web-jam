class MyClient {
  constructor(){
    this.authToken
    this.emailValidated = false
    document.getElementById("emailColourForm").onsubmit = this.check_email.bind(this)
    document.getElementById("logoImg").onclick = this.generate_magic_link.bind(this)
    document.getElementById("bgcolSel").onchange = this.save_bgcol.bind(this)
  }


  auth(){
    const self = this
    const magicLink = self.get_parameter_by_name("mlk")
    if (magicLink === null){
      return
    }
    const upData = {
      "magicLink": magicLink
    }
    console.log("upData:", upData)
    fetch("/api/auth", {
      method: "POST",
      body: JSON.stringify(upData),
      headers: { "Content-Type": "application/json" }
    })
    .then(
      function(res){
        console.log("res:", res)
        return res.json()
      }
      // res => res.json()
    )
    .then(
      function(downData){
      // downData => {
        console.log(downData)
        if (downData.msg === "Authentication successful!"){
          self.authToken = downData.authToken
          // Remove magic link box from the page.
          self.remove_children_of_element("magicLinkArea")
          const div = document.getElementById("magicLinkArea")
          const lbl = document.createElement("label")
          lbl.setAttribute("for", "emailAddr")
          const txt = document.createTextNode("You are signed in.")
          lbl.appendChild(txt)
          div.appendChild(lbl)
          div.appendChild(self.make_a_break())
          div.appendChild(self.make_a_break())
          div.appendChild(self.make_a_break())
          // Tweak the select element label.
          self.remove_children_of_element("bgcolSelLabel")
          const lbl2 = document.getElementById("bgcolSelLabel")
          const txt2 = document.createTextNode("Choose your background colour:")
          lbl2.appendChild(txt2)
          // Enable the select element.
          document.getElementById("bgcolSel").removeAttribute("disabled")
          // Make it and the page show the user's previous
          // background colour selection.
          if (downData.bgcol !== undefined){
            document.getElementById("bgcolSel").value = downData.bgcol
            document.body.style.background = downData.bgcol
          }
          // Scrub the magic link from the URL.
          if (window.history.pushState){
            let newUrl = new URL(window.location.href)
            newUrl.search = ""
            console.log("newUrl:", newUrl)
            window.history.pushState(
              {
                "path": newUrl.href
              }, "", newUrl.href
            )
          }
        }
        else if (downData.msg === "Session expired."){
          alert(
            "Your session has expired. Please re-enter " +
            "your email address to generate a new magic link."
          )
        }
        else if (downData.msg === "Invalid magic link"){
          alert(
            "We did not recognise the magic link. " +
            "Please try again."
          )
        }
      }
    )
  }


  generate_magic_link(){
    const self = this
    if (!self.emailValidated || !self.double_check_email()){
      return
    }
    const ea = document.getElementById("emailAddr").value
    const upData = {
      "emailAddr": ea
    }
    fetch("/api/magicLink", {
      method: "POST",
      body: JSON.stringify(upData),
      headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(downData => {
      console.log(downData)
      // Remove the form and display a message instead.
      if (downData.msg === "Link generated and email sent to existing user." || downData.msg === "Link generated and email sent to new user."){
        self.remove_children_of_element("magicLinkArea")
        const div = document.getElementById("magicLinkArea")
        const lbl = document.createElement("label")
        lbl.setAttribute("for", "emailAddr")
        const txt = document.createTextNode(
          "An email has been sent to " + ea + ". " +
          "Please check there for the magic link to sign in."
        )
        lbl.appendChild(txt)
        div.appendChild(lbl)
        div.appendChild(self.make_a_break())
        div.appendChild(self.make_a_break())
        div.appendChild(self.make_a_break())
      }
    })
  }


  save_bgcol(){
    const self = this
    const currCol = document.getElementById("bgcolSel").value
    document.body.style.background = currCol
    const upData = {
      "authToken": self.authToken,
      "bgcol": currCol
    }
    fetch("/api/saveBgcol", {
      method: "POST",
      body: JSON.stringify(upData),
      headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(downData => {
      console.log(downData)
      // If save successful there is nothing to do.
      if (downData.msg === "Session expired."){
        alert(
          "Your session has expired and your most recent " +
          "change was not saved. Please re-enter your email " +
          "address to generate a new magic link."
        )
        // Recreate the email address input and submit button.
        self.remove_children_of_element("magicLinkArea")
        const div = document.getElementById("magicLinkArea")
        const lbl = document.createElement("label")
        lbl.setAttribute("for", "emailAddr")
        const txt = document.createTextNode("Get a magic link sent to your email address:")
        lbl.appendChild(txt)
        div.appendChild(lbl)
        div.appendChild(self.make_a_break())
        const inp = document.createElement("input")
        inp.setAttribute("id", "emailAddr")
        inp.setAttribute("name", "emailAddr")
        inp.setAttribute("required", null)
        inp.setAttribute("type", "text")
        div.appendChild(inp)
        const btn = document.createElement("button")
        const txt2 = document.createTextNode(" ")
        div.appendChild(txt2)
        btn.setAttribute("type", "submit")
        const txt3 = document.createTextNode("Submit")
        btn.appendChild(txt3)
        div.appendChild(btn)
        div.appendChild(self.make_a_break())
        div.appendChild(self.make_a_break())
        // Disable the colour select.
        document.getElementById("bgcolSel").setAttribute("disabled", null)
      }
      else if (downData.msg === "Invalid magic link"){
        alert(
          "We did not recognise the magic link. " +
          "Please try again."
        )
      }
    })
  }


  // Utility-like stuff
  check_email(){
    console.log("this:", this)
    const ea = document.getElementById("emailAddr").value
    console.log("ea:", ea)
    if (ea.indexOf("@") === -1){
      alert("That doesn't look like an email address. Please try again.")
      return false
    }
    this.emailValidated = true
    alert("Please press or click the logo further down this page to confirm you are not a bot.")
    return false
  }


  double_check_email(){
    const ea = document.getElementById("emailAddr").value
    console.log("ea:", ea)
    if (ea.indexOf("@") === -1){
      alert("Something went wrong with your email address. Please enter a valid email address and try again.")
      return false
    }
    return true
  }


  get_parameter_by_name(name){
    let match = RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, " "))
  }


  remove_children_of_element(id){
    const el = document.getElementById(id)
    while(el.firstChild){
      el.removeChild(el.firstChild)
    }
  }


  make_a_break(){
    let br = document.createElement("br")
    return br
  }
}


const myClient = new MyClient()
myClient.auth()


// Something simple to test Nodemailer
// document.getElementById("sendMailButton").onclick = function(){
//   console.log("GOT HERE!")
//   const upData = {
//     "author": "Christopher",
//     "text": "Er, hi!"
//   }
//   fetch("/api/sendMail", {
//     method: "POST",
//     body: JSON.stringify(upData),
//     headers: { "Content-Type": "application/json" }
//   })
//   .then(res => res.json())
//   .then(downData => {
//     console.log(downData)
//   })
// }


// Version of the code where I don't bother with a MyClient class. I would code the onsubmit, onclick, and onchange from the constructor into src -> views -> index.hbs.

// let authToken
// let emailValidated = false

// function auth(){
//   const magicLink = get_parameter_by_name("mlk")
//   if (magicLink === null){
//     return
//   }
//   const upData = {
//     "magicLink": magicLink
//   }
//   console.log("upData:", upData)
//   fetch("/api/auth", {
//     method: "POST",
//     body: JSON.stringify(upData),
//     headers: { "Content-Type": "application/json" }
//   })
//   .then(
//     function(res){
//       console.log("res:", res)
//       return res.json()
//     }
//     // res => res.json()
//   )
//   .then(
//     function(downData){
//     // downData => {
//       console.log(downData)
//       if (downData.msg === "Authentication successful!"){
//         authToken = downData.authToken
//         // Remove magic link box from the page.
//         remove_children_of_element("magicLinkArea")
//         const div = document.getElementById("magicLinkArea")
//         const lbl = document.createElement("label")
//         lbl.setAttribute("for", "emailAddr")
//         const txt = document.createTextNode("You are signed in.")
//         lbl.appendChild(txt)
//         div.appendChild(lbl)
//         div.appendChild(make_a_break())
//         div.appendChild(make_a_break())
//         div.appendChild(make_a_break())
//         // Tweak the select element label.
//         remove_children_of_element("bgcolSelLabel")
//         const lbl2 = document.getElementById("bgcolSelLabel")
//         const txt2 = document.createTextNode("Choose your background colour:")
//         lbl2.appendChild(txt2)
//         // Enable the select element.
//         document.getElementById("bgcolSel").removeAttribute("disabled")
//         // Make it and the page show the user's previous
//         // background colour selection.
//         if (downData.bgcol !== undefined){
//           document.getElementById("bgcolSel").value = downData.bgcol
//           document.body.style.background = downData.bgcol
//         }
//         // Scrub the magic link from the URL.
//         if (window.history.pushState){
//           let newUrl = new URL(window.location.href)
//           newUrl.search = ""
//           console.log("newUrl:", newUrl)
//           window.history.pushState(
//             {
//               "path": newUrl.href
//             }, "", newUrl.href
//           )
//         }
//       }
//       else if (downData.msg === "Session expired."){
//         alert(
//           "Your session has expired. Please re-enter " +
//           "your email address to generate a new magic link."
//         )
//       }
//       else if (downData.msg === "Invalid magic link"){
//         alert(
//           "We did not recognise the magic link. " +
//           "Please try again."
//         )
//       }
//     }
//   )
// }

// auth()


// document.getElementById("bgcolSel").onchange = function(){
//   const currCol = document.getElementById("bgcolSel").value
//   document.body.style.background = currCol
//   const upData = {
//     "authToken": authToken,
//     "bgcol": currCol
//   }
//   fetch("/api/saveBgcol", {
//     method: "POST",
//     body: JSON.stringify(upData),
//     headers: { "Content-Type": "application/json" }
//   })
//   .then(res => res.json())
//   .then(downData => {
//     console.log(downData)
//     // If save successful there is nothing to do.
//     if (downData.msg === "Session expired."){
//       alert(
//         "Your session has expired and your most recent " +
//         "change was not saved. Please re-enter your email " +
//         "address to generate a new magic link."
//       )
//       // Recreate the email address input and submit button.
//       remove_children_of_element("magicLinkArea")
//       const div = document.getElementById("magicLinkArea")
//       const lbl = document.createElement("label")
//       lbl.setAttribute("for", "emailAddr")
//       const txt = document.createTextNode("Get a magic link sent to your email address:")
//       lbl.appendChild(txt)
//       div.appendChild(lbl)
//       div.appendChild(make_a_break())
//       const inp = document.createElement("input")
//       inp.setAttribute("id", "emailAddr")
//       inp.setAttribute("name", "emailAddr")
//       inp.setAttribute("required", null)
//       inp.setAttribute("type", "text")
//       div.appendChild(inp)
//       const btn = document.createElement("button")
//       const txt2 = document.createTextNode(" ")
//       div.appendChild(txt2)
//       btn.setAttribute("type", "submit")
//       const txt3 = document.createTextNode("Submit")
//       btn.appendChild(txt3)
//       div.appendChild(btn)
//       div.appendChild(make_a_break())
//       div.appendChild(make_a_break())
//       // Disable the colour select.
//       document.getElementById("bgcolSel").setAttribute("disabled", null)
//     }
//     else if (downData.msg === "Invalid magic link"){
//       alert(
//         "We did not recognise the magic link. " +
//         "Please try again."
//       )
//     }
//   })
// }


// function image_click(){
//   if (!emailValidated || !double_check_email()){
//     return
//   }
//   const ea = document.getElementById("emailAddr").value
//   const upData = {
//     "emailAddr": ea
//   }
//   fetch("/api/magicLink", {
//     method: "POST",
//     body: JSON.stringify(upData),
//     headers: { "Content-Type": "application/json" }
//   })
//   .then(res => res.json())
//   .then(data => {
//     console.log(data)
//     // Remove the form and display a message instead.
//     if (data.msg === "Link generated and email sent to existing user." || data.msg === "Link generated and email sent to new user."){
//       remove_children_of_element("magicLinkArea")
//       const div = document.getElementById("magicLinkArea")
//       const lbl = document.createElement("label")
//       lbl.setAttribute("for", "emailAddr")
//       const txt = document.createTextNode(
//         "An email has been sent to " + ea + ". " +
//         "Please check there for the magic link to sign in."
//       )
//       lbl.appendChild(txt)
//       div.appendChild(lbl)
//       div.appendChild(make_a_break())
//       div.appendChild(make_a_break())
//       div.appendChild(make_a_break())
//     }
//   })
// }


// function check_email(){
//   const ea = document.getElementById("emailAddr").value
//   console.log("ea:", ea)
//   if (ea.indexOf("@") === -1){
//     alert("That doesn't look like an email address. Please try again.")
//     return false
//   }
//   emailValidated = true
//   alert('Please press or click the "JS jewel" image further down this page to confirm you are not a bot.')
//   return false
// }


// function double_check_email(){
//   const ea = document.getElementById("emailAddr").value
//   console.log("ea:", ea)
//   if (ea.indexOf("@") === -1){
//     alert("Something went wrong with your email address. Please enter a valid email address and try again.")
//     return false
//   }
//   return true
// }


// function get_parameter_by_name(name){
//   let match = RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
//   return match && decodeURIComponent(match[1].replace(/\+/g, " "))
// }


// function remove_children_of_element(id){
//   const el = document.getElementById(id)
//   while(el.firstChild){
//     el.removeChild(el.firstChild)
//   }
// }


// function make_a_break(){
//   let br = document.createElement("br")
//   return br
// }



// document.getElementById("testRemove").onclick = function(){
//   console.log("GOT HERE!")
//   remove_children_of_element("emailColourForm")
// }
