#!/usr/bin/env python3
"""ONC — 管理 CLI（直连数据库，绕过 HTTP 鉴权；用于在 center 容器内建节点/任务）

  python manage.py create-node --name 香港-01 --label1 香港 --label2 CN2
  python manage.py list-nodes
  python manage.py create-task --name 沪→京 --source <node_id> --protocol icmp --target 1.1.1.1
  python manage.py list-tasks
"""
import argparse
import json

import db


def main():
    db.init_db()
    p = argparse.ArgumentParser(description="ONC 管理 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    pn = sub.add_parser("create-node", help="创建节点（返回一次性 token）")
    pn.add_argument("--name", required=True)
    pn.add_argument("--label1", default="")
    pn.add_argument("--label2", default="")
    pn.add_argument("--label3", default="")

    sub.add_parser("list-nodes", help="列出节点")

    pt = sub.add_parser("create-task", help="创建探测任务")
    pt.add_argument("--name", required=True)
    pt.add_argument("--source", required=True, help="源节点 id")
    pt.add_argument("--protocol", required=True, choices=["icmp", "tcp", "udp", "http", "dns"])
    pt.add_argument("--target", help="外部目标地址/URL")
    pt.add_argument("--target-type", default="external", choices=["external", "internal"])
    pt.add_argument("--target-node", help="内部目标节点 id")
    pt.add_argument("--port", type=int)
    pt.add_argument("--interval", type=int, default=5)
    pt.add_argument("--timeout", type=int, default=5)

    sub.add_parser("list-tasks", help="列出任务")

    a = p.parse_args()

    if a.cmd == "create-node":
        r = db.create_node(a.name, a.label1, a.label2, a.label3)
        print(json.dumps(r, ensure_ascii=False, indent=2))
        print("\n⚠ token 仅此一次显示，请保存（部署 agent 时用）")
    elif a.cmd == "list-nodes":
        for n in db.list_nodes():
            print(f'{n["id"]}  {n["name"]:<16} {n["status"]:<8} {n.get("public_ip") or "-"}')
    elif a.cmd == "create-task":
        tid = db.create_task(
            a.name, a.source, a.protocol, target_address=a.target,
            target_type=a.target_type, target_node_id=a.target_node,
            target_port=a.port, interval=a.interval, timeout=a.timeout,
        )
        print(f"task created: {tid}")
    elif a.cmd == "list-tasks":
        for t in db.list_tasks():
            tgt = t.get("target_address") or t.get("target_node_id") or "-"
            print(f'{t["id"]}  {t["name"]:<16} {t["protocol"]:<5} src={t["source_node_id"]} -> {tgt}')


if __name__ == "__main__":
    main()
