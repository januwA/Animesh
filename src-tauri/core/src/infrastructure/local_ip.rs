//! 局域网网卡选择工具:从系统网卡列表中挑选最适合对外暴露流媒体地址的 IPv4。

/// 从一组 (网卡名, IP) 中挑选最佳 IPv4 字符串。
///
/// 评分规则:
/// - 私网地址 +10
/// - WLAN/无线 关键词 +50;以太网关键词 +30
/// - 虚拟网卡关键词(vpn/wsl/docker/xray 等)-100
/// - 回环、未指定、链路本地地址直接跳过
/// - 最终得分 < 0 视为无可用地址(避免误选虚拟网卡)
fn select_best_local_ip(interfaces: Vec<(String, std::net::IpAddr)>) -> Option<String> {
    use std::net::IpAddr;

    let mut best_ip: Option<(String, i32)> = None;

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

        let ip_str = ipv4.to_string();
        match &best_ip {
            Some((_, best_score)) => {
                if score > *best_score {
                    best_ip = Some((ip_str, score));
                }
            }
            None => {
                best_ip = Some((ip_str, score));
            }
        }
    }

    // 只返回真实可达的物理网卡地址;虚拟网卡(xray/Tailscale/WSL 等)优先级过低,
    // 若没有更好的候选则视为无可用地址,交由调用方回退到 127.0.0.1
    match best_ip {
        Some((ip, score)) if score >= 0 => Some(ip),
        _ => None,
    }
}

/// 获取本机最佳局域网 IPv4。无可用物理网卡时返回 None。
pub fn get_local_ip() -> Option<String> {
    use local_ip_address::list_afinet_netifas;

    if let Ok(interfaces) = list_afinet_netifas() {
        if let Some(ip) = select_best_local_ip(interfaces) {
            return Some(ip);
        }
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
    fn 测试_选择最佳局域网IP_优先级() {
        let user_interfaces = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "vEthernet (WSL (Hyper-V firewall))".to_string(),
                "172.31.208.1".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.0.106".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            select_best_local_ip(user_interfaces),
            Some("192.168.0.106".to_string())
        );

        let loopback_only = vec![
            ("lo".to_string(), "127.0.0.1".parse::<IpAddr>().unwrap()),
            (
                "unspecified".to_string(),
                "0.0.0.0".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(select_best_local_ip(loopback_only), None);

        let multiple_physical = vec![
            (
                "以太网".to_string(),
                "192.168.1.100".parse::<IpAddr>().unwrap(),
            ),
            (
                "WLAN".to_string(),
                "192.168.1.101".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            select_best_local_ip(multiple_physical),
            Some("192.168.1.101".to_string())
        );

        let simple_ip = vec![(
            "my_nic".to_string(),
            "192.168.1.50".parse::<IpAddr>().unwrap(),
        )];
        assert_eq!(
            select_best_local_ip(simple_ip),
            Some("192.168.1.50".to_string())
        );

        let link_local_only = vec![(
            "以太网".to_string(),
            "169.254.112.178".parse::<IpAddr>().unwrap(),
        )];
        assert_eq!(select_best_local_ip(link_local_only), None);

        let apipa_with_vpn = vec![
            ("xray0".to_string(), "198.18.0.1".parse::<IpAddr>().unwrap()),
            (
                "以太网".to_string(),
                "169.254.112.178".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(select_best_local_ip(apipa_with_vpn), None);

        let link_local_with_real = vec![
            (
                "以太网".to_string(),
                "169.254.112.178".parse::<IpAddr>().unwrap(),
            ),
            (
                "以太网".to_string(),
                "192.168.0.108".parse::<IpAddr>().unwrap(),
            ),
        ];
        assert_eq!(
            select_best_local_ip(link_local_with_real),
            Some("192.168.0.108".to_string())
        );
    }
}
