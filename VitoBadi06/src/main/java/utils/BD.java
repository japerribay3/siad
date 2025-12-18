/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package utils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 *
 * @author MCO
 */
public class BD {

    // Referencia a un objeto de la interface java.sql.Connection 
    private static Connection conn;

    public static Connection getConexion() {
        if (conn == null) {
            try {
                Class.forName("com.mysql.cj.jdbc.Driver");
                //conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/bdjugadores2", "root", "root");
                conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/vitobadi06?serverTimezone=UTC", "root", "admin");
                System.out.println("Se ha conectado.");
            } catch (ClassNotFoundException ex1) {
                System.out.println("No se ha conectado: " + ex1);
            } catch (SQLException ex2) {
                System.out.println("No se ha conectado:" + ex2);
            }
        }
        return conn;
    }
}
