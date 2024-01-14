let body, terminalContents, terminalTitle, projectsContainer, projectTitle, projectImageWebp, projectImageFallback, projectDetails;
const DEBUG = navigator.userAgent.includes("Electron"); // vscode live preview is based on Electron
const MOBILE = window.matchMedia("(max-width: 610px)").matches;
const CONTACT_EMAIL = "hello@th0m4s.dev";

// pseudo-AGE
let currentDate = new Date();
let age = currentDate.getFullYear() - 2002;
if(currentDate.getMonth() < 6) age--;

$(async () => {
    body = $(document.body);
    body.on("keydown", (event) => {
        if(event.key == "Escape")
            closeProject();
    });

    $(window).on("hashchange", (event) => {
        if(openingProjectHash) {
            openingProjectHash = false;
        } else openProjectFromHash();
    });

    terminalContents = $("#terminal-contents");
    terminalTitle = $("#terminal-title");

    projectsContainer = $("#projects-container");
    projectTitle = $("#project-title");
    projectImageWebp = $("#project-image-webp");
    projectImageFallback = $("#project-image-fallback");
    projectDetails = $("#project-details");

    updateTerminalHeader();
    openProjectFromHash();

    if(!DEBUG) {
        for(let i = 0; i < 3; i++) {
            await sleep(250);
            terminalContents.text(terminalContents.text().trim() + ".");
        }

        clearTerminal();

        // addContent("Logged in as th0m4s_ledos!");
        // await sleep(600);
        clearTerminal();

        /*terminalContents.css({opacity: 0});
        setTimeout(() => {
            terminalContents.css({transition: "0.2s ease-in", opacity: 1});
        }, 0);*/
    }

    clearTerminal();
    setupFilesystem();
    setupTerminal();

    showIntro();
    askCommand(true);
});

function addContent(contents = "", classes = "") {
    let element = $("<div />").addClass(classes).html(transformText(contents + "\n"));
    terminalContents.append(element);

    return element;
}

function clearTerminal() {
    terminalContents.html("");
}

function updateTerminalHeader() {
    terminalTitle.html(getAskPrefix());
}

function showIntro() {
    internalExec("cat /about.txt");
}

// INTERACTIVE TERMINAL
let currentPath = "/";
let currentInput = undefined;

let commands = {};
let filesystem = {};

function resolvePath(requestedPath) {
    if(!requestedPath.startsWith("/")) {
        let currentParts = currentPath.substring(1).split("/").filter(x => x.length > 0);
        let requestedParts = requestedPath.split("/").filter(x => x.length > 0);

        for(let part of requestedParts) {
            if(part == "..") {
                currentParts.shift();
            } else if(part != ".") currentParts.push(part);
        }

        requestedPath = "/" + currentParts.join("/");
    }

    return requestedPath;
}

function registerCommand(name, help, execute) {
    commands[name] = {help, execute};
}

function setupFilesystem() {
    filesystem = {
        "projects": {
            type: "dir",
            entries: {}
        },
        "links": {
            type: "dir",
            entries: {
                "github.txt": {
                    type: "file",
                    contents: `<img src="/img/github_light_32.png" alt="GitHub icon" class="side-image-link"><div class="side-text-link">th0m4s' GitHub profile:
                        <a href="https://github.com/th0m4s/" target="_blank">https://github.com/th0m4s/</a></div>`
                },
                "linkedin.txt": {
                    type: "file",
                    contents: `<img src="/img/linkedin_light_32.png" alt="LinkedIn icon" class="side-image-link"><div class="side-text-link">Thomas LEDOS' LinkedIn profile:
                        <a href="https://www.linkedin.com/in/thomasledos/" target="_blank">https://www.linkedin.com/in/thomasledos/</a></div>`
                }
            }
        },
        "files": {
            type: "dir",
            entries: {
                "cv_english.pdf": {
                    type: "file",
                    contents: "Cannot display this document inside the terminal.\nClick <a href='/files/CV_ThomasLEDOS_en.pdf' target='_blank'>here</a> to open this PDF document in a new tab."
                },
                "cv_french.pdf": {
                    type: "file",
                    contents: "Cannot display this document inside the terminal.\nClick <a href='/files/CV_ThomasLEDOS_fr.pdf' target='_blank'>here</a> to open this PDF document in a new tab."
                }
            }
        },
        "about.txt": {
            type: "file",
            contents: TEXTS.about
        },
        "contact.txt": {
            type: "file",
            contents: `You can contact me on Discord (<a href="https://discord.com/users/130031546844315649" target="_blank">th0m4s</a>)
                or by email at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`
        }
    };

    for(let [name, project] of Object.entries(PROJECTS)) {
        filesystem.projects.entries[name + ".txt"] = {
            type: "file",
            contents: `<b>${project.name}</b> <small>(click <a href="#" onclick="openProject('${name}'); return false;">here</a> to view the full details)</small>
                ${project.small}\n
                ${project.details}`
        };
    }
}

function setupTerminal() {
    terminalContents.on("click", () => {
        if(currentInput != undefined) currentInput.focus();
    });

    registerCommand("help", "shows this help message", () => {
        let helpMessage = "List of available commands:";
        for(let [name, {help}] of Object.entries(commands)) {
            if(help != undefined && help.trim().length > 0)
                helpMessage += "\n&nbsp;" + name + ": " + help;
        }

        helpMessage += "\n\nUp and down arrow keys navigate inside your commands history.\nUse <i>cat /about.txt</i> to display the welcome text again.";
        addContent(helpMessage);
    });

    registerCommand("clear", "clears the terminal screen", () => {
        clearTerminal();
    });

    registerCommand("pwd", "prints the current working directory", () => {
        addContent(currentPath);
    });

    registerCommand("cd", "changes the current working directory", (args) => {
        if(args.length == 0) {
            currentPath = "/"; // "/" is this terminal's home directory :)
        } else {
            let requestedPath = resolvePath(args[0]);

            let type = getPathType(requestedPath);
            if(type == "dir") {
                currentPath = requestedPath;

                if(currentPath.startsWith("/projects")) {
                    $("#projects-container").css({opacity: 1, display: "block"});

                    if(MOBILE)
                        $(document).scrollTop(projectsContainer.offset().top - 12);
                    else setupGalleryInterval(); // not the best animation ever...
                }
            } else if(type == "file") {
                addContent(`cd: ${args[0]}: not a directory`);
            } else addContent(`cd: ${args[0]}: no such file or directory`);
        }

        updateTerminalHeader();
    });

    registerCommand("cat", "prints a file to the screen", (args) => {
        if(args.length == 0 || args[0].trim().length == 0) {
            addContent("cat: no file specified");
        } else {
            let path = resolvePath(args[0]);
            let type = getPathType(path);
            if(type == "file") {
                addContent(getPathStructure(path).contents);
            } else if(type == "dir") {
                addContent(`cat: ${args[0]}: is a directory`);
            } else addContent(`cat: ${args[0]}: no such file or directory`);
        }
    });

    registerCommand("echo", "echoes a message back to the screen", (args) => {
        addContent(args.join(" "));
    });

    registerCommand("ls", "lists files and directories inside a directory", (args) => {
        let requestedPath = currentPath;
        let showAll = false, showLines = false, humanSizes = false;
        for(let arg of args) {
            if(arg.startsWith("-")) {
                if(arg.includes("a")) showAll = true;
                if(arg.includes("l")) showLines = true;
                if(arg.includes("h")) humanSizes = true;
            } else {
                requestedPath = resolvePath(arg);
                break;
            }
        }

        let structure = getPathStructure(requestedPath);
        let entries = Object.assign(showAll ? {".": {type: "dir"}, "..": {type: "dir"}} : {}, structure.entries);
        if(structure.type == "dir") {
            if(Object.keys(entries).length > 0) {
                if(showLines) {
                    let lines = Object.entries(entries).map(([name, entry]) => { return {size: transformSize(getSize(requestedPath + "/" + name, false), humanSizes), name: name, type: entry.type}});

                    let maxSizeLength = Math.max(...lines.map(line => line.size.length));
                    let totalSize = getSize(requestedPath, false, true);

                    addContent("total " + (humanSizes ? transformSize(totalSize) : totalSize) +"\n" + lines.map(line => (line.type == "dir" ? "d" : "-") + "rw-rw-r-- 1 th0m4s th0m4s " + "&nbsp;".repeat(maxSizeLength - line.size.length) + line.size + " " + line.name).join("\n"));
                } else {
                    let message = "";

                    for(let [name, entry] of Object.entries(entries)) {
                        if(entry.type == "file") message += `<i class="terminal-ls">${name}</i>`;
                        else message += `<span class="terminal-ls">${name}</span>`;
                    }
        
                    addContent(message);
                }
            }
        } else {
            addContent("ls: not a directory");
        }
    });

    registerCommand("exit", undefined, () => {
        addContent("Sorry to see you go! You'll have to close the tab yourself to leave this website.");
    });

    registerCommand("id", undefined, (_args, sudo) => {
        if(sudo)
            addContent("uid=0(root) gid=0(root) groups=0(root)");
        else addContent("uid=1000(th0m4s) gid=1000(th0m4s) groups=1000(th0m4s),27(sudo)");
    });

    registerCommand("whoami", undefined, (_args, sudo) => {
        if(sudo)
            addContent("root");
        else addContent("th0m4s");
    });

    registerCommand("sudo", undefined, (args) => {
        return internalExec(args.join(" "), true);
    });

    registerCommand("apt", undefined, async (args, sudo) => {
        if(args.length == 0) {
            addContent("custom apt v1.0.0 (js)\nUsage: apt [options] command");
        } else switch(args[0]) {
            case "install":
                if(sudo) {
                    addContent("Read-only file system!");
                } else {
                    addContent("<span style='color: red;'>E:</span> Could not open lock file - open (13: Permission denied)");
                }
            case "update":
                let firstLine = addContent("Reading package lists...", "test");
                await sleep(1000);
                firstLine.html("Reading package lists... Done");

                if(sudo) {
                    addContent("Already up-to-date!");
                } else {
                    addContent("<span style='color: red;'>E:</span> Could not open lock file - open (13: Permission denied)");
                }
                break;
            default:
                addContent("<span style='color: red;'>E:</span> Invalid operation " + args[0]);
                break;
        }
    });

    registerCommand("mv", undefined, () => {
        addContent("Read-only filesystem!");
    });

    registerCommand("cp", undefined, () => {
        addContent("Read-only filesystem!");
    });

    registerCommand("rm", undefined, () => {
        addContent("Read-only filesystem!");
    });

    registerCommand("mkdir", undefined, () => {
        addContent("Read-only filesystem!");
    });

    registerCommand("nano", undefined, () => {
        addContent("Why don't you try using vi?");
    });

    registerCommand("vi", undefined, () => {
        addContent("Why don't you try using nano?");
    });
}

function transformSize(size, humanSize = true) {
    return humanSize && size > 1024 ? (size / 1024).toFixed(1) + "K" : size.toString();
}

function getPathType(path) {
    let structure = getPathStructure(path);
    if(structure == undefined) return undefined;
    else return structure.type;
}

function getPathStructure(path) {
    if(typeof path != "string" || path.length == 0) return undefined;

    let parts = path.substring(1).split("/").filter(x => x.length > 0);
    let lastPart = parts.pop();

    let currentEntries = filesystem;
    if(lastPart == undefined) return {type: "dir", entries: currentEntries};

    for(let part of parts) {
        let newStructure = currentEntries[part];
        if(newStructure != undefined && newStructure.type == "dir") {
            currentEntries = newStructure.entries;
        } else return false;
    }

    let requestedStructure = currentEntries[lastPart];
    if(requestedStructure == undefined) return false;
    else return requestedStructure;
}

function getSize(path, real = false, rec = false) {
    if(!real && (path.endsWith("/.") || path.endsWith("/.."))) return 4096;

    let structure = getPathStructure(path);

    if(structure == undefined || structure == false) return 0;
    else if(structure.type == "file") return structure.contents.length;
    else if(!real && !rec) return 4096; // directory inside a directory is an entry list, don't go further

    let size = 0;
    for(let [name, entry] of Object.entries(structure.entries)) {
        if(entry.type == "file") size += Math.max(entry.contents.length, 4096);
        else size += real ? getSize(name, real, true) : 4096; // 4096 is the minimum size of an entry on disk (small file or directory)
    }

    return size;
}

function getAskPrefix() {
    return `th0m4s_ledos@portfolio:${currentPath}`;
}

let commandsHistory = [];
let historyCommandId = 0;

let tabOriginal = "";
let tabSuggestions = [];
let tabSuggId = -1;

function askCommand(firstCommand = false) {
    historyCommandId = 0;
    commandsHistory.unshift("");

    addContent(`${getAskPrefix()}$ <input class="current-input terminal-input" aria-label="command input" />`, "ask-command");
    currentInput = $(".current-input");
    
    if(!DEBUG || !firstCommand) currentInput.focus();

    currentInput.on("keydown", (event) => {
        switch(event.key) {
            case "Enter":
                executeCommand(currentInput.val());
                break;
            case "ArrowUp":
                event.preventDefault();
                if(historyCommandId+1 < commandsHistory.length) {
                    if(historyCommandId == 0) commandsHistory[0] = currentInput.val();
                    putCursorAtEnd(currentInput.val(commandsHistory[++historyCommandId]));
                }
                break;
            case "ArrowDown":
                event.preventDefault();
                if(historyCommandId > 0) {
                    putCursorAtEnd(currentInput.val(commandsHistory[--historyCommandId]));
                }
                break;
            case "Tab":
                event.preventDefault();

                if(tabSuggId == -1) {
                    tabOriginal = currentInput.val();

                    let current = "";
                    if(tabOriginal.trim().length > 0) {
                        let originalParts = matchParts(tabOriginal);
                        current = originalParts.pop();
                        tabOriginal = originalParts.join(" ") + " ";
                    }

                    let suggPath = currentPath;
                    let pathParts = current.split("/");
                    pathParts.pop();
                    if(pathParts.length > 0) {
                        if(pathParts.length == 1 && pathParts[0] == "") {
                            suggPath = "/";
                            tabOriginal += "/";
                        } else {
                            suggPath = pathParts.join("/");
                            tabOriginal += suggPath + "/";
                        }
                        
                        if(!suggPath.startsWith("/"))
                            suggPath = resolvePath(suggPath);
                    }

                    let structure = getPathStructure(suggPath);
                    if(structure.type == "dir") {
                        let currentLast = "";
                        if(current.length > 0)
                            currentLast = current.split("/").pop();
                        tabSuggestions = Object.keys(structure.entries).filter(x => x.startsWith(currentLast));

                        if(tabSuggestions.length > 0) {
                            tabSuggId = 0;
                            currentInput.val(tabOriginal + tabSuggestions[0]);
                        }
                    }
                } else {
                    currentInput.val(tabOriginal + tabSuggestions[++tabSuggId % tabSuggestions.length]);
                }
                break;
            default:
                tabOriginal = "";
                tabSuggestions = [];
                tabSuggId = -1;
                break;
        }
    });

    scrollTerminal();
    if(MOBILE) currentInput.attr("disabled", "disabled");
}

async function internalExec(command, sudo = false) {
    let parts = matchParts(command);

    if(parts != null && parts.length > 0) {
        let commandName = parts.shift();

        if(commands[commandName] != undefined) {
            await commands[commandName].execute(parts, sudo);
        } else addContent(commandName + ": command not found");
    }
}

async function executeCommand(command) {
    if(currentInput != undefined) {
        command = command.trim();

        currentInput.attr("disabled", "disabled").removeClass("current-input");
        currentInput.val(command); // in case of command from about/intro message

        if(command.length == 0 || (commandsHistory.length > 1 && commandsHistory[1] == command)) commandsHistory.shift();
        else commandsHistory[0] = command;

        currentInput = undefined;

        await internalExec(command);
        askCommand();
    }
}

function scrollTerminal() {
    terminalContents.scrollTop(terminalContents.height());
}


// PROJECT WINDOW
const PROJECTS = {
    "platform_manager": {
        name: "Platform Manager",
        images: {
            fallback: "/img/projects/platform_manager.png",
            webp: "/img/projects/platform_manager.webp"
        },
        small: "NodeJS-based PaaS",
        details: `Platform Manager is a VPS/server dashboard to manage apps and mail accounts for multiple users. It was created to work like a PaaS (Platform as a Service), one example being Heroku. As each dyno was billed separately, the goal of this dashboard is to be able to run multiple projects/website at the cost of a single server.\n
            Each project runs in an isolated Docker container and supports multiple backends, from Apache, Nginx and NodeJS and all the features are added by custom plugins, including databases, persistent storage, custom domains or even custom DNS records.\n
            The entire dashboard, from the frontend to all the backends components and servers are built using Javascript but new components can be created in other languages using the custom process intercom for more flexibility.\n
            It supports large-scale projects with rate limiters, web servers in different workers, the Docker process memory limiters and the current WIP feature is horizontal scalability to split processes in different servers.\n\n
            For more details about Platform Manager or how to install it, check out the GitHub repository at <a href="https://github.com/th0m4s/platform_manager" target="_blank">https://github.com/th0m4s/platform_manager</a>.`
    },
    "keys_manager": {
        name: "Keys Manager",
        images: {
            fallback: "/img/projects/keys_manager.png",
            webp: "/img/projects/keys_manager.webp"
        },
        small: "Client managing SSH keys",
        details: `Keys Manager simple goal is to secure SSH keys. Password-based SSH authentication is not the recommended nor the most secure way of configuring a server, but managing SSH keys is also not that easy, specially if you have multiple computers or want to be able to login anywhere without the need of a USB stick with the keys in case of an emergency.\n
            Keys Manager does that for you! You upload your keys on your panel, and as no password is saved, you keep the control on how they can be used. There is no way to download the key from the panel after the upload, you need to use the second part of Keys Manager, the client.\n
            The Keys Manager client is a Windows application that supports custom Keys Manager servers and is in charge of downloading and removing the keys automatically as these actions are performed on the panel using a secure and authenticated WebSocket. It also creates PuTTY profiles to connect to your server in a single click.\n
            On the panel, you also have a view of each session of your account, including the sessions created by the clients and you can remove them at any time. A planned feature is to send an email each time a key or multiple keys are downloaded to reduce the delay of disabling the leaked key(s).\n\n
            At that time, the backend is not available on GitHub but don't hesitate to contact me at <a href="mailto:${CONTACT_EMAIL}" target="_blank">${CONTACT_EMAIL}</a> for more information.`
    },
    "minecraft_plugins": {
        name: "Minecraft plugins",
        images: {
            fallback: "/img/projects/minecraft_plugins.png",
            webp: "/img/projects/minecraft_plugins.webp"
        },
        small: "Various Bukkit plugins in Java",
        details: `During a summer camp, one of the activity leaders created a Minecraft server on his VPS for the children. As I had some Java experience, after the camp ended, I started to create plugins to achieve really simple tasks like protecting zones, automating gifts or even adding more damage to fishing rods.\n
            A year later, with some friends of middle school, we started working on a Minecraft server with minigame, and while others were creating the maps, I was in charge of creating the plugins. It was at that time I discovered BungeeCord and the proxy architecture of Minecraft.
            I made plugins in charge of economy, games, lobbies, permissions and even mystery boxes (inspired from the Hypixel Network)... You can check out many of these plugins on my GitHub repository: <a href="https://github.com/th0m4s/historical-bukkit-plugins" target="_blank">https://github.com/th0m4s/historical-bukkit-plugins</a>.\n    
            However, have you seen a group of 4 middle-schoolers opening a large minigames server? At least we were ambitious and I didn't regret this experience, as I learned many new things about development. During the end of the project, I published on dev.bukkit.org the <i>PacksShop</i> plugin to give multiple items in a single command (it was to simplify the products inside the shop CMS), and after the project was cancelled, I worked on <i>AlwaysOp</i>, a plugin to test permissions and other plugins as a regular player by deoping yourself and reoping you when necessary.\n
            You can check the 2 latest plugins on my dev.bukkit.org account here: <a href="https://dev.bukkit.org/members/th0m4s92/projects" target="_blank">https://dev.bukkit.org/members/th0m4s92/projectst</a>. Even if all the plugins are using the Bukkit SDK, I tried to stay up-to-date with the latest servers including Spigot and Paper (forks of Bukkit).`
    },
    "websites": {
        name: "Various websites",
        images: {
            fallback: "/img/projects/websites.png",
            webp: "/img/projects/websites.webp"
        },
        small: "Various static or interactive websites",
        details: `As it can be deducted from the other projects, I really enjoy programming in my free time, and that include various websites I made throughout the years. The latest one is the website you're on, and if you take a look at it's code, I honestly think that it contains improvements compared to the first ones I made.\n
            <i> &bull; Vetnet: </i>\nFor example, during a summer camp, we had to imagine a tech project, and with my group, we though about a smart screen generating outfits based on what you have in your wardrobe, and it had a semi-working demo (the shown outfit is static) at <a href="https://vetnet.th0m4s.dev/" target="_blank">https://vetnet.th0m4s.dev/</a>.
            It even had a chat to discuss with all the people from the summer camp after it has ended, because not everyone had a phone at that time.\n 
            <i> &bull; Normandy house rental: </i>\nAnother, more professional, website is the one I made for the rental house of my grandparents in Normandy. It detects your country based on your IP address and shows either the french or the english version. It was one of my first time sending mails in PHP. You can check out this website here: <a href="https://manche-location.fr/" target="_blank">https://manche-location.fr/</a>.\n    
            <i> &bull; Naix'd (group of friends): </i>\nMoreover, during the first year of the pandemic, I was in the last year of high-school, and me and my friends all went to pursue our studies at different places, schools, universites..., so I made a website, starting with an interactive map to know where was everyone. As the first lockdown was lifted, we all wanted to see other so the website was upgraded with an interactive calendar to find the best date to organize a party...
            Today, there are more services like a downloader of our Minecraft server world saves and many more... (as this website contains private information, I cannot share the URL here, but I'll be happy to talk about it if required, therefore don't hesitate to contact me).`
    },
    "laserman": {
        name: "TheLaserMan",
        images: {
            fallback: "/img/projects/laserman.png",
            webp: "/img/projects/laserman.webp"
        },
        small: "Android arcade game made with Unity3D",
        details: `TheLaserMan is my first <i>large</i> project I worked on, it started more than ${age-15} years ago. Even I tried lots in the past of Unity3D features, for this mobile arcade game, I chose to remain in a 2D space with simple sprites to concentrate on more important aspect like a game manager, a generator for unique runs and a cloud save system.\n
            It made me learn about new SDK, like the new Unity Input system or the Play Games SDK for Unity and these were the first documentations I read carefully. At the beginning, not everything would work correctly, the save could be corrupted by playing offline or with different devices and there was no bonuses.\
            Nowadays, the game have bonuses like a magnet to attract coins, a shield to break obstacles and daily challenges.\n
            Even if I consider the game completed for more than ${age-17} years, I was affraid of publishing the game, so it's still in beta, but you can check it out here by joining the beta on Google Play: <a href="#" target="_blank">Join TheLaserMan beta</a> (app pending review).`
    },
    "space_saver": {
        name: "Space Saver",
        images: {
            fallback: "/img/projects/space_saver.png",
            webp: "/img/projects/space_saver.webp"
        },
        small: "Submission for the Gynvael's Winter GameDev Challenge 2018/2019",
        details: `blabla spacer saverAt the end of 2018, a Youtube named <i>LiveOverflow</i> collaborated with Gynvael Coldwind to organize a gamedev challenge, where all participants where given 5 weeks to build a game running on Chrome and Windows 10 (at least, it could of course run on other systems and browsers). As it runs in a browser client, the game had to be made with Javascript but could of course contains WebAssembly code in C, C++ or Rust.\
            Some restrictions were given, like a back story of a hacker helping space marines visiting an abandonned space station, the usage of an overlay with 2 separate displays, a maximum of 20 files and 128 000 bytes (approx. 128kb).\n
            I discovered the world of game jams with this challenge and tried to fulfill it. My game, <i>Space Saver</i>, was about finding reports inside devices by hacking them to understand where the ship crew went, but some games were about leaving or escaping a ship. I honestly really liked the constraints because it forces you to learn new ways of coding to improve performance and many other aspects of a program.\n
            I'm proud of it because even if it wasn't on the podium, my submission won an honorable mention. You can test my submission and all the other games here: <a href="http://gwgc2018.gynvael.tv/ThomasLEDOS_SpaceSaver.html" target="_blank">http://gwgc2018.gynvael.tv/</a> and check out the rules on Gynvael's blog here: <a href="https://gynvael.coldwind.pl/?id=697" target="_blank">https://gynvael.coldwind.pl/?id=697</a>.`
    },
    "gcode_car_simulator": {
        name: "gcode car simulator",
        images: {
            fallback: "/img/projects/gcode_car_simulator.png",
            webp: "/img/projects/gcode_car_simulator.webp"
        },
        small: "gcode car simulator for school",
        details: `During my first year of Engineering school, one of my lesson was the <i>construction</i> of a small car profile in a CD. To achieve this, we had to use a really large machine that can cut and drill metal pieces. To control this machine, we needed to feed it a program wrote in <i>gcode</i>. This is a set of instruction indicating how the tools inside the machine should move.\n
            However, we were warned that the machine can broke easily if a tool touch a screw maintaining the disc in place, and checking all the class programs manually would have taken a long time, and online existing simulators would not print error messages, because they are specific to our exercice. It gave me the idea to build a custom gcode simulator, only executing basic instructions for linear and circular movement (G0 to G3) but a view of the disc, the screws and messages about requirements not being fulfilled.\n 
            It completely works within the client browser and the server is only responsible of the save system used to send cars instructions between users.\n
            During the semester, I realized that we needed figures of each car model, this is why I added an image generator inside the "Export..." menu below the simulation screen.\n 
            You can check out the simulator here (messages in french): <a href="https://techfab-tools.th0m4s.dev/" target="_blank">https://techfab-tools.th0m4s.dev/</a>.
            If you want to try it with a car, you can use this link: <a href="https://techfab-tools.th0m4s.dev/?car=a8s4" target="_blank">https://techfab-tools.th0m4s.dev/?car=a8s4</a>.`
    },
    "salute_assistant": {
        name: "Salute Assistant",
        images: {
            fallback: "/img/projects/salute_assistant.png",
            webp: "/img/projects/salute_assistant.webp"
        },
        small: "Java assistant with speech recognition",
        details: `Salute Assistant is a Java program made some years ago with the goal of replacing an AI assistant like Google Home or Amazon Alexa by running on a Raspnerry PI connected to the TV and a speaker. The full working version with a TV and the offline speech recognition of the keyword "Hey Salute" to start it never happened, but the program was working on a PC.\n
            It was created to support multiple languages, but only French was built for it (with sentences, verbs...). You simply ask a question and Salute tries to answer it the best way possible, everything with cloud-based speech recognition and local text-to-speech (TTS).\n
            The features are: weather, books, people info (birth, age and death), mails, time, definitions and units conversion, but the program is customizable and adding a feature is easy, you just need to add a Java class to the project.\n
            Even if I don't use it everyday, I'm proud of it and I'm currently working on publishing the source code of this project (after removing API product keys and correcting some compile issues). For more information or to get the project, don't hesitate to contact me <a href="#" onclick="closeProject(); executeCommand('cat /contact.txt'); return false;">here</a>.`
    }
};

let projectGalleryInterval = -1, galleryHovered = false;
function setupGalleryInterval() {
    if(projectGalleryInterval <= 0) {
        if(projectGalleryInterval < 0) {
            projectsContainer.on("mouseover", () => {
                galleryHovered = true;
            }).on("mouseleave", () => {
                galleryHovered = false;
            });
        }

        let galleryCounter = 0, galleryCounterMax = 100;
        let galleryPosition = 0, galleryCount = Object.keys(PROJECTS).length - 3;
        let scrollPart = projectsContainer.width() / 3;

        projectGalleryInterval = setInterval(() => {
            if(!galleryHovered)
                galleryCounter++;

            if(galleryCounter >= galleryCounterMax) {
                galleryCounter = 0;

                let currentScroll = projectsContainer.scrollLeft();
                if(Math.abs(currentScroll - (galleryPosition % (galleryCount+1)) * scrollPart) > 10) {
                    galleryPosition = Math.floor(currentScroll / scrollPart);
                }

                projectsContainer.scrollLeft((++galleryPosition % (galleryCount+1)) * scrollPart);
            }
        }, 100);
    }
}

function clearGalleryInterval() {
    if(projectGalleryInterval > 0) {
        clearInterval(projectGalleryInterval);
        projectGalleryInterval = 0;
    }
}

let openingProjectHash = false;
function openProject(projectId, changeHash = true) {
    let project = PROJECTS[projectId];
    if(project == undefined) return;

    projectTitle.html("Project - " + project.name);
    projectImageWebp.attr("srcset", project.images.webp);
    projectImageFallback.attr("src", project.images.fallback);
    projectDetails.html(`<b>${project.name}</b><br/><span class="project-subdetails">${project.small}</span>
        <br/><br/><br/>${transformText(project.details)}`);

    body.addClass("project-details-visible");

    if(changeHash) {
        openingProjectHash = true;
        window.location.hash = "project-" + projectId;
    }
}

function openProjectFromHash() {
    let hash = window.location.hash;
    if(hash.startsWith("#project-")) {
        let projectId = hash.substring(9);
        openProject(projectId, false);
    } else closeProject();
}

function closeProject() {
    body.removeClass("project-details-visible");
    history.replaceState("", document.title, window.location.pathname);
}


// UTILS
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchParts(text) {
    let parts = text.match(/("[^"]+"|[^\s"]+)/g);
    if(parts != null && text.endsWith(" ")) parts.push("");
    return parts;
}

function transformText(text) {
    return text.replace(/\n/g, "<br/>");
}

function putCursorAtEnd(field) {
    setTimeout(() => {
        let pos = field.val().length;
        field.get(0).setSelectionRange(pos, pos, "forward");
    }, 0);
}

// TEXTS
const TEXTS = {
    about: `<pre class="welcome-ascii-art"> _   _      ___            _  _\n| |_| |__  / _ \\ _ __ ___ | || |  ___ \n| __| '_ \\| | | | '_ \` _ \\| || |_/ __|\n| |_| | | | |_| | | | | | |__   _\\__ \\\n \\__|_| |_|\\___/|_| |_| |_|  |_| |___/</pre><b>Welcome to my portfolio!</b>\n
        Hello, I am Thomas LEDOS, a ${age}-year old student in Engineering at <a target="_blank" href="https://esilv.fr/en/">ESILV</a> near Paris, majoring in <i>Internet of Things and Cybersecurity</i>. My main hobby since many years is programming and I hope that my experience could help you develop your project.\n
        I'm specializing in working with Javascript (NodeJS & client; with enough knowledge of HTML/CSS) but I've worked with different languages throughout the years, including Python, Java, C# and PHP.\n
        I also manage the Linux server, network and databases for all of my projects. To know more about these, try the <i>help</i> command in this terminal or use the links below, and thanks for reading :)\n
        <a class="message-link" href="https://github.com/th0m4s/" target="_blank"><img src="/img/github_light_32.png" alt="GitHub icon" class="small-link-image" width="15px" height="15px">GitHub</a><a class="message-link" href="https://www.linkedin.com/in/thomasledos/" target="_blank"><img src="/img/linkedin_light_32.png" alt="LinkedIn icon" class="small-link-image" width="15px" height="15px">LinkedIn</a><a class="message-link" href="#" onclick="executeCommand('cd /projects'); return false;">Projects</a><a class="message-link" href="#" onclick="executeCommand('help'); return false;">Show help</a><a class="message-link" href="/files/CV_ThomasLEDOS_en.pdf" target="_blank">CV (english)</a><a class="message-link" href="/files/CV_ThomasLEDOS_fr.pdf" target="_blank">CV (french)</a><a class="message-link" href="mailto:${CONTACT_EMAIL}" onclick="executeCommand('cat /contact.txt'); return false;">Contact</a>\n`
};