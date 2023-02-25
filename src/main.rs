use tray_item::TrayItem;
use std::process::Command;
use colored::Colorize;
use reqwest;
use serde_json;

fn main() {
    let mut tray = TrayItem::new("PlutoApp", "").unwrap();

    tray.add_label("Tray Label").unwrap();

    tray.add_menu_item("info", || {
        get_info();
    }).unwrap();

    tray.add_menu_item("kill", || {
        kill_notebooks();
    }).unwrap();

    let inner = tray.inner_mut();
    inner.add_quit_item("Quit");
    inner.display();
}

fn get_info() -> serde_json::Value {
    let info_raw = send_cmd("info").unwrap(); // returns a json string
    let info: serde_json::Value = serde_json::from_str(&info_raw).unwrap();
    return info;
}

fn kill_notebooks() {
    send_cmd("kill").unwrap();
    println!("{} {:?}", "[ Info:".bold().magenta(), "Killed all notebooks");
}

fn send_cmd(cmd: &str) -> Result<String, reqwest::Error> {
    let url = format!("http://127.0.0.1:8080/{}", cmd);
    let body = reqwest::blocking::get(url)?.text()?;
    println!("{} {:?}", "[ Info:".bold().magenta(), body);
    Ok(body)
}

