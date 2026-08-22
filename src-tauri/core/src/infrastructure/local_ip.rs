//! 局域网网卡选择工具:从系统网卡列表中挑选最适合对外暴露流媒体地址的 IPv4。

/// 对一组 (网卡名, IP) 进行评分,返回按得分降序排列的候选列表。
///
/// 评分规则:
/// - 私网地址 +10
/// - WLAN/无线 关键词 +50;以太网关键词 +30
/// - 虚拟网卡关键词(vpn/wsl/docker/xray 等)-100
/// - 回环、未指定、链路本地地址直接跳过
/// - 最终得分 < 0 视为无可用地址(避免误选虚拟网卡)
fn score_interfaces(interfaces: Vec<(String, std::net::IpAddr)>) -> Vec<(String, i32)> {
    use std::net::IpAddr;

    let mut candidates: Vec<(String, i32)> = Vec::new();

    for (name, ip) in interfaces {
        let ipv4 = match ip {
            IpAddr::V4(v4) => v4,
            _ => continue, // Ignore IPv6 for stream URL compatibility
        };

        // 回环、未指定以及链路本地地址(169.254.x.x / APIPA)均不适合作为流地址,
        // APIPA 是网卡拿不到 DHCP 时的临时地址,随时会失效导致 URL 不可达
        if ipv4.is_loopback() || ipv4.is_unspecified() {
            continue;
        }

        let octets = ipv4.octets();
        let is_link_local = octets[0] == 169 && octets[1] == 254;
        if is_link_local {
            continue;
        }

        let name_lower = name.to_lowercase();
        let mut score = 0;

        let is_private = (octets[0] == 10)
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168);

        if is_private {
            score += 10;
        }

        let ignore_keywords = [
            "virtual",
            "vbox",
            "vmware",
            "virtualbox",
            "hyper-v",
            "wsl",
            "veth",
            "vethernet",
            "xray",
            "tun",
            "tap",
            "tailscale",
            "zerotier",
            "vpn",
            "ppp",
            "docker",
            "loopback",
        ];

        if ignore_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score -= 100;
        }

        let wifi_keywords = ["wlan", "wifi", "wi-fi", "wireless", "无线"];
        let ethernet_keywords = ["ethernet", "eth", "以太网", "本地连接", "lan"];

        if wifi_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score += 50;
        } else if ethernet_keywords.iter().any(|&kw| name_lower.contains(kw)) {
            score += 30;
        }

        candidates.push((ipv4.to_string(), score));
    }

    // 按得分降序排列,优先尝试高分候选
    candidates.sort_by_key(|b| std::cmp::Reverse(b.1));

    candidates
}

/// 从评分后的候选列表中选择第一个可达的 IP。
fn pick_reachable_ip(candidates: Vec<(String, i32)>) -> Option<String> {
    use std::net::UdpSocket;

    for (ip, score) in candidates {
        if score < 0 {
            break;
        }
        let addr = format!("{ip}:0");
        if UdpSocket::bind(&addr).is_ok() {
            return Some(ip);
        }
    }

    None
}

/// 获取本机最佳局域网 IPv4。无可用物理网卡时返回 None。
#[cfg(target_os = "windows")]
pub fn get_local_ip() -> Option<String> {
    use ipconfig::OperStatus;

    let Ok(adapters) = ipconfig::get_adapters() else {
        return None;
    };

    // 收集已连接适配器的 (名称, IP) 列表
    let interfaces: Vec<(String, std::net::IpAddr)> = adapters
        .iter()
        .filter(|a| a.oper_status() == OperStatus::IfOperStatusUp)
        .flat_map(|a| {
            let name = a.friendly_name().to_string();
            a.ip_addresses().iter().map(move |ip| (name.clone(), *ip))
        })
        .collect();

    pick_reachable_ip(score_interfaces(interfaces))
}

/// 获取本机最佳局域网 IPv4。无可用物理网卡时返回 None。
#[cfg(not(target_os = "windows"))]
pub fn get_local_ip() -> Option<String> {
    use local_ip_address::list_afinet_netifas;

    if let Ok(interfaces) = list_afinet_netifas() {
        return pick_reachable_ip(score_interfaces(interfaces));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    #[test]
    #[allow(non_snake_case)]
    fn 测试_获取局域网IP_逻辑() {
        let ip = get_local_ip();
        if let Some(ref addr) = ip {
            assert_ne!(addr, "0.0.0.0");
            assert_ne!(addr, "127.0.0.1");
            assert_eq!(addr.split('.').count(), 4);
        }
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_评分_虚拟网卡被降权() {
        let interfaces = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "vEthernet (WSL (Hyper-V firewall))".to_string(),
                "172.31.208.1".parse::<IpAddr>().unwrap(),
            ),
        ];
        let candidates = score_interfaces(interfaces);
        assert!(candidates.iter().all(|(_, score)| *score < 0));
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_评分_WLAN优先于以太网() {
        let interfaces = vec![
            (
                "以太网".to_string(),
                "192.168.1.100".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.1.101".parse::<IpAddr>().unwrap(),
            ),
        ];
        let candidates = score_interfaces(interfaces);
        assert_eq!(candidates.len(), 2);
        // WLAN(+50+10=60) > 以太网(+30+10=40)
        assert_eq!(candidates[0].0, "192.168.1.101");
        assert_eq!(candidates[0].1, 60);
        assert_eq!(candidates[1].0, "192.168.1.100");
        assert_eq!(candidates[1].1, 40);
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_评分_回环和未指定地址被过滤() {
        let interfaces = vec![
            ("lo".to_string(), "127.0.0.1".parse::<IpAddr>().unwrap()),
            (
                "unspecified".to_string(),
                "0.0.0.0".parse::<IpAddr>().unwrap(),
            ),
        ];
        let candidates = score_interfaces(interfaces);
        assert!(candidates.is_empty());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_评分_链路本地地址被过滤() {
        let interfaces = vec![(
            "以太网".to_string(),
            "169.254.112.178".parse::<IpAddr>().unwrap(),
        )];
        let candidates = score_interfaces(interfaces);
        assert!(candidates.is_empty());
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_评分_简单网卡() {
        let interfaces = vec![(
            "my_nic".to_string(),
            "192.168.1.50".parse::<IpAddr>().unwrap(),
        )];
        let candidates = score_interfaces(interfaces);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].0, "192.168.1.50");
    }

    #[test]
    #[allow(non_snake_case)]
    fn 测试_可达性验证_选择本机真实IP() {
        let result = get_local_ip();
        if let Some(ip) = result {
            let addr = format!("{ip}:0");
            assert!(
                std::net::UdpSocket::bind(&addr).is_ok(),
                "选出的 IP {ip} 不可达"
            );
        }
    }
}
