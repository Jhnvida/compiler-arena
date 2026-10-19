export const PRESET_HUNTER = `// Robô Hunter: Perseguição tática e combate em terreno aberto
robot Hunter {
    int dist;
    int step;
    step = step + 1;
    
    scan();
    if (position.x < 90 || position.x > 810 || position.y < 90 || position.y > 810) {
        rotate(75);
        move(25);
    } else {
        if (enemy.visible) {
            dist = enemy.distance;
            rotate(enemy.direction);
            if (dist < 130) {
                fire(3);
                back(20);
            } else {
                if (dist < 280) {
                    fire(2);
                    move(18);
                } else {
                    fire(1);
                    move(28);
                }
            }
        } else {
            if (step % 4 == 0) {
                rotate(45);
            }
            move(25);
        }
    }
}
`;

export const PRESET_SNIPER = `// Robô Sniper Scout: Varredura de longo alcance e reposicionamento contínuo
robot SniperScout {
    int dist;
    int step;
    step = step + 1;
    
    scan();
    if (position.x < 110 || position.x > 790 || position.y < 110 || position.y > 790) {
        rotate(90);
        move(25);
    } else {
        if (enemy.visible) {
            rotate(enemy.direction);
            dist = enemy.distance;
            if (dist < 180) {
                fire(3);
                back(25);
                rotate(30);
            } else {
                if (dist > 360) {
                    fire(1);
                    move(15);
                } else {
                    fire(2);
                    if (step % 2 == 0) {
                        rotate(20);
                        move(15);
                    } else {
                        back(10);
                    }
                }
            }
        } else {
            if (step % 5 == 0) {
                rotate(60);
            }
            move(22);
        }
    }
}
`;

export const PRESET_STRIKER = `// Robô Aggressive Striker: Assalto frontal e disparos contínuos
robot AggressiveStriker {
    int dist;
    int step;
    step = step + 1;
    
    scan();
    if (position.x < 90 || position.x > 810 || position.y < 90 || position.y > 810) {
        rotate(95);
        move(25);
    } else {
        if (enemy.visible) {
            dist = enemy.distance;
            rotate(enemy.direction);
            if (dist > 250) {
                move(30);
                fire(2);
            } else {
                fire(3);
                if (dist < 100) {
                    back(15);
                    rotate(35);
                } else {
                    move(20);
                }
            }
        } else {
            if (step % 3 == 0) {
                rotate(50);
            }
            move(30);
        }
    }
}
`;

export const PRESET_PATROL = `// Robô Wandering Patrol: Patrulha e navegação pela arena aberta
robot WanderingPatrol {
    int step;
    step = step + 1;
    
    scan();
    if (position.x < 90 || position.x > 810 || position.y < 90 || position.y > 810) {
        rotate(90);
        move(25);
    } else {
        if (enemy.visible) {
            rotate(enemy.direction);
            if (enemy.distance < 140) {
                fire(3);
                back(15);
            } else {
                fire(2);
                move(18);
            }
        } else {
            if (step % 5 == 0) {
                rotate(55);
            }
            move(24);
        }
    }
}
`;

export const PRESET_OPTIMIZATION_DEMO = `// Exemplo para demonstração de otimizações (Constant Folding + Simplificação Algébrica + Dead Code)
robot OptDemo {
    int constantFold = 10 + 20 * 2;   // Dobrado para 50
    int algebraicX = constantFold * 1 + 0; // Simplificado para constantFold
    int zeroMul = algebraicX * 0;     // Simplificado para 0
    
    if (false) {
        // Bloco inalcançável: eliminado pelo otimizador de código
        move(999);
        fire(3);
    } else {
        move(algebraicX);
        fire(2);
    }
}
`;

export const PRESET_ERRORS_DEMO = `// Exemplo didático com múltiplos erros para demonstrar diagnósticos
robot BuggyTank {
    int energy = 100;     // ERRO: Nome reservado de sensor
    int speed = 5;
    int speed = 10;       // ERRO: Declaração duplicada
    
    move(false);          // ERRO: Argumento booleano em vez de numérico
    fire(10);             // ERRO: Potência fora do intervalo [1, 3]
    enemy.visible = true; // ERRO: Sensores são somente leitura
    enemy = 123;          // ERRO: Modificação de sensor
}
`;
